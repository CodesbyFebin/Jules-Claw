import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { consumeQuota } from '../lib/quotas.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL required; use a disposable test database');
const pool = new pg.Pool({ connectionString });
const id = 'f3474fcb-4313-4f55-817f-9ad7c10f85ea';
try {
  for (const n of ['0002_verification_jobs.sql', '0003_worker_leases.sql', '0004_audit_quotas.sql']) {
    await pool.query(await readFile(new URL('../migrations/' + n, import.meta.url), 'utf8'));
  }
  await pool.query("INSERT INTO verification_jobs (id,pull_request_url,repo_owner,repo_name,commit_sha,profile) VALUES ($1,$2,$3,$4,$5,$6)", [id,'https://github.com/a/b/pull/1','a','b','a'.repeat(40),'syntax']);
  const worker = 'a25dd520-8149-4cb9-b48f-082498676401';
  await pool.query("UPDATE verification_jobs SET status='running', started_at=now(), heartbeat_at=now(), worker_id=$2, attempts=attempts+1 WHERE id=$1", [id,worker]);
  const heartbeat = await pool.query("UPDATE verification_jobs SET heartbeat_at=now() WHERE id=$1 AND worker_id=$2 AND status='running' RETURNING id", [id,worker]);
  assert.equal(heartbeat.rowCount, 1);
  const stranger = await pool.query("UPDATE verification_jobs SET heartbeat_at=now() WHERE id=$1 AND worker_id=$2 AND status='running' RETURNING id", [id,'b25dd520-8149-4cb9-b48f-082498676401']);
  assert.equal(stranger.rowCount, 0);
  await pool.query("UPDATE verification_jobs SET heartbeat_at=now()-interval '6 minutes' WHERE id=$1", [id]);
  const reclaimed = await pool.query(`UPDATE verification_jobs SET status='infra_failure', finished_at=now(),
    stderr=right(stderr || E'\\nWorker heartbeat expired; result unknown.', $1)
    WHERE status='running' AND (heartbeat_at IS NULL OR heartbeat_at < now()-interval '5 minutes') RETURNING id`, [32000]);
  assert.equal(reclaimed.rows.some(r => r.id === id), true);
  const outdated = await pool.query("UPDATE verification_jobs SET status='passed' WHERE id=$1 AND worker_id=$2 AND status='running'", [id,worker]);
  assert.equal(outdated.rowCount, 0);
  const state = await pool.query("SELECT status, attempts, stderr FROM verification_jobs WHERE id=$1", [id]);
  assert.equal(state.rows[0].status, 'infra_failure');
  assert.equal(state.rows[0].attempts, 1);
  assert.match(state.rows[0].stderr, /result unknown/);
  const events = await pool.query('SELECT event,old_status,new_status FROM execution_audit WHERE job_id=$1 ORDER BY id', [id]);
  assert.deepEqual(events.rows.map(row => row.new_status), ['queued','running','infra_failure']);
  assert.equal(events.rows[0].event, 'created');
  const prefix = 'ci_verify_' + Date.now();
  const fixed = new Date('2026-10-23T10:00:00Z');
  const attempts = await Promise.all(Array.from({ length: 7 }, () => consumeQuota(pool, prefix, 3, 3600, fixed)));
  assert.equal(attempts.filter(x => x.allowed).length, 3);
  assert.equal(attempts.filter(x => !x.allowed).length, 4);
  await pool.query('DELETE FROM request_quotas WHERE operation=$1', [prefix]);
  process.stdout.write('Lease ownership, heartbeat expiry, fencing and recovery: PASS\n');
} finally {
  await pool.query('DELETE FROM verification_jobs WHERE id=$1', [id]).catch(() => {});
  await pool.query('DELETE FROM execution_audit WHERE job_id=$1', [id]).catch(() => {});
  await pool.end();
}
