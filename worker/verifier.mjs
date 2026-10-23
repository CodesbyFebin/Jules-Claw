import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const pool = new pg.Pool({ connectionString: url, max: 2 });
const image = process.env.VERIFIER_IMAGE || 'open-jules-verifier:local';
const pollMs = 3000;
const outputLimit = 32000;
const workerId = randomUUID();
const heartbeatMs = 5000;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout = (stdout + d).slice(-outputLimit); });
    child.stderr.on('data', d => { stderr = (stderr + d).slice(-outputLimit); });
    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeout || 60000);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? 137, signal, stdout, stderr });
    });
  });
}

async function claim() {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const found = await conn.query("SELECT * FROM verification_jobs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
    if (!found.rowCount) { await conn.query('COMMIT'); return null; }
    const job = found.rows[0];
    await conn.query("UPDATE verification_jobs SET status='running', started_at=now(), heartbeat_at=now(), worker_id=$2, attempts=attempts+1 WHERE id=$1", [job.id, workerId]);
    await conn.query('COMMIT');
    return job;
  } catch (e) { await conn.query('ROLLBACK'); throw e; }
  finally { conn.release(); }
}

async function heartbeat(id) {
  const r = await pool.query(
    "UPDATE verification_jobs SET heartbeat_at=now() WHERE id=$1 AND worker_id=$2 AND status='running' RETURNING id",
    [id, workerId]
  );
  return r.rowCount === 1;
}

async function recoverStale() {
  // Abandoned jobs are terminal infra failures, never inferred successes or silently retried.
  const r = await pool.query(
    `UPDATE verification_jobs SET status='infra_failure', finished_at=now(),
       stderr=right(stderr || E'\\nWorker heartbeat expired; result unknown.', $1)
       WHERE status='running' AND (heartbeat_at IS NULL OR heartbeat_at < now() - interval '5 minutes')
       RETURNING id`,
    [outputLimit]
  );
  for (const row of r.rows) {
    try {
      const cleanup = await run('docker', ['rm', '-f', 'open-jules-' + row.id], { timeout: 10000 });
      if (cleanup.code !== 0) process.stderr.write('Stale container cleanup: ' + cleanup.stderr + '\n');
    } catch (e) { process.stderr.write('Stale container cleanup unavailable: ' + e.message + '\n'); }
  }
  return r.rowCount;
}

async function cancelled(id) {
  const r = await pool.query('SELECT cancel_requested FROM verification_jobs WHERE id=$1', [id]);
  return !r.rowCount || r.rows[0].cancel_requested;
}

async function finish(job, status, result) {
  await pool.query(
    `UPDATE verification_jobs SET
       status=CASE WHEN cancel_requested THEN 'cancelled' ELSE $3 END,
       exit_code=$4, stdout=$5, stderr=$6, finished_at=now(), heartbeat_at=now()
       WHERE id=$1 AND worker_id=$2 AND status='running'`,
    [job.id, workerId, status, result.code ?? null, result.stdout || '', result.stderr || '']
  );
}

async function verify(job) {
  const temp = await mkdtemp(join(tmpdir(), 'open-jules-verify-'));
  const containerName = 'open-jules-' + job.id;
  let result = { code: null, stdout: '', stderr: '' };
  const beat = setInterval(() => {
    heartbeat(job.id).catch(e => process.stderr.write('Heartbeat failure: ' + e.message + '\n'));
  }, heartbeatMs);
  try {
    const repo = 'https://github.com/' + job.repo_owner + '/' + job.repo_name + '.git';
    // The API resolves this SHA from GitHub; the worker never executes user-provided shell.
    for (const args of [
      ['init', temp],
      ['-C', temp, 'remote', 'add', 'origin', repo],
      ['-C', temp, 'fetch', '--depth=1', 'origin', job.commit_sha],
      ['-C', temp, 'checkout', '--detach', 'FETCH_HEAD'],
    ]) {
      if (await cancelled(job.id)) return await finish(job, 'cancelled', result);
      const step = await run('git', args, { timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
      if (step.code !== 0) throw new Error('Git retrieval failed: ' + step.stderr.slice(-2000));
    }
    if (await cancelled(job.id)) return await finish(job, 'cancelled', result);
    await chmod(temp, 0o755);
    const script = job.profile === 'syntax' ? '/opt/verifier/syntax-check.mjs' : '/opt/verifier/node-tests.mjs';
    const args = [
      'run', '--rm', '--name', containerName, '--network', 'none', '--read-only',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--pids-limit', '128', '--memory', '512m', '--cpus', '1',
      '--user', '1000:1000', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
      '--mount', 'type=bind,source=' + temp + ',target=/work,readonly',
      '--workdir', '/work', image, 'node', script
    ];
    let stopInFlight = false;
    const monitor = setInterval(async () => {
      if (stopInFlight) return;
      try {
        if (await cancelled(job.id)) {
          stopInFlight = true;
          await run('docker', ['rm', '-f', containerName], { timeout: 10000 });
        }
      } catch (e) { process.stderr.write('Cancellation monitor: ' + e.message + '\n'); }
    }, 1000);
    try { result = await run('docker', args, { timeout: 150000 }); }
    finally { clearInterval(monitor); await run('docker', ['rm', '-f', containerName], { timeout: 10000 }).catch(() => {}); }
    await finish(job, result.code === 0 ? 'passed' : 'failed', result);
  } catch (e) {
    await finish(job, 'infra_failure', { ...result, stderr: (result.stderr + '\n' + e.message).slice(-outputLimit) });
  } finally {
    clearInterval(beat);
    await rm(temp, { recursive: true, force: true });
  }
}

let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
try {
  let lastRecovery = 0;
  while (!stopping) {
    if (Date.now() - lastRecovery > 30000) {
      await recoverStale();
      lastRecovery = Date.now();
    }
    const job = await claim();
    if (job) await verify(job);
    else await new Promise(r => setTimeout(r, pollMs));
  }
} finally { await pool.end(); }
