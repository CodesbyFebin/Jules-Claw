// Bounded real-process crash/restart recovery on a disposable legacy queue.
// Does not qualify production tenant-wide worker privileges.
import assert from 'node:assert/strict';
import pg from 'pg';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
if (process.env.QUALIFICATION_DISPOSABLE !== 'I_CONFIRM_DISPOSABLE') throw new Error('Disposable qualification only');
const url = process.env.TEST_WORKER_DATABASE_URL;
if (!url || new URL(url).pathname !== '/open_web_llm_worker_qualification') throw new Error('Dedicated disposable worker database required');
const db = new pg.Pool({ connectionString: url, max: 2 });
const id = randomUUID();
const waitFor = async (predicate, maxMs = 20000) => {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(250);
  }
  throw new Error('Timed out waiting for real worker recovery');
};
function startWorker() {
  const proc = spawn(process.execPath, ['worker/verifier.mjs'], {
    env: { ...process.env, DATABASE_URL: url, WORKER_DATABASE_URL: url, JULES_AUTH_ENABLED: 'false' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let captured = '';
  proc.stderr.on('data', b => { captured = (captured + b.toString()).slice(-2048); });
  proc.on('error', () => {});
  return { proc, getErrors: () => captured };
}
async function kill(proc) {
  if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
  await new Promise(resolve => proc.once('close', resolve));
}
try {
  await db.query(
    "INSERT INTO verification_jobs(id,pull_request_url,repo_owner,repo_name,commit_sha,profile,status,worker_id,attempts,heartbeat_at) VALUES ($1,'https://github.com/a/b/pull/1','a','b',$2,'syntax','running',$3,1,now()-interval '10 minutes')",
    [id, 'a'.repeat(40), randomUUID()],
  );
  const one = startWorker();
  try {
    await waitFor(async () => (await db.query('SELECT status FROM verification_jobs WHERE id=$1',[id])).rows[0]?.status === 'infra_failure');
  } finally { await kill(one.proc); }
  const first = await db.query('SELECT status,attempts,stderr FROM verification_jobs WHERE id=$1', [id]);
  assert.equal(first.rows[0].status, 'infra_failure');
  assert.equal(first.rows[0].attempts, 1);
  assert.match(first.rows[0].stderr, /heartbeat expired/);

  const two = startWorker();
  try {
    await delay(3500);
    assert.equal(two.proc.exitCode, null);
  } finally { await kill(two.proc); }
  const final = await db.query('SELECT status, attempts FROM verification_jobs WHERE id=$1', [id]);
  assert.deepEqual(final.rows[0], { status:'infra_failure', attempts:1 });
  const audit = await db.query('SELECT new_status FROM execution_audit WHERE job_id=$1 ORDER BY id', [id]);
  assert.deepEqual(audit.rows.map(r=>r.new_status), ['running','infra_failure']);
  process.stdout.write('Real Node worker restart, stale lease fencing, no duplicate retry: PASS (disposable legacy queue)\n');
} finally {
  await db.query('DELETE FROM verification_jobs WHERE id=$1', [id]).catch(()=>{});
  await db.query('DELETE FROM execution_audit WHERE job_id=$1', [id]).catch(()=>{});
  await db.end();
}
