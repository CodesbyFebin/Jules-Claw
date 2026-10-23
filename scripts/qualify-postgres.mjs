// Open Web LLM — live PostgreSQL adversarial qualification.
// Never run against a non-disposable database. Credentials supplied by CI only.
import assert from 'node:assert/strict';
import pg from 'pg';

if (process.env.QUALIFICATION_DISPOSABLE !== 'I_CONFIRM_DISPOSABLE') {
  throw new Error('Refusing database qualification outside a confirmed disposable environment');
}
const { QUALIFY_ADMIN_URL, QUALIFY_APP_URL, QUALIFY_WORKER_URL } = process.env;
if (![QUALIFY_ADMIN_URL, QUALIFY_APP_URL, QUALIFY_WORKER_URL].every(Boolean)) {
  throw new Error('Three isolated qualification database connections required');
}
const admin = new pg.Pool({ connectionString: QUALIFY_ADMIN_URL, max: 4 });
const app = new pg.Pool({ connectionString: QUALIFY_APP_URL, max: 12 });
const worker = new pg.Pool({ connectionString: QUALIFY_WORKER_URL, max: 3 });
const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '20000000-0000-4000-8000-000000000002';

async function scoped(pool, tenant, statement, params = []) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('jules.tenant_id', $1, true)", [tenant]);
    const result = await c.query(statement, params);
    await c.query('COMMIT');
    return result;
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
}

try {
  const safety = await admin.query('SELECT current_database() AS name, pg_is_in_recovery() AS recovery');
  assert.match(safety.rows[0].name, /^open_web_llm_qualification$/);
  assert.equal(safety.rows[0].recovery, false);
  const principals = await admin.query(
    "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('owll_app_ci', 'owll_worker_ci')"
  );
  assert.equal(principals.rowCount, 2);
  assert(principals.rows.every(r => !r.rolsuper && !r.rolbypassrls));

  const policies = await admin.query(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('desk_entries','verification_jobs')`);
  assert.equal(policies.rowCount, 2);
  assert(policies.rows.every(r => r.relrowsecurity && r.relforcerowsecurity));

  await admin.query('INSERT INTO jules_tenants(id) VALUES ($1),($2) ON CONFLICT DO NOTHING', [tenantA, tenantB]);
  const a = await scoped(app, tenantA,
    "INSERT INTO desk_entries(title,detail,status,tenant_id) VALUES ('a isolated','tenant a','note',$1) RETURNING id", [tenantA]);
  const b = await scoped(app, tenantB,
    "INSERT INTO desk_entries(title,detail,status,tenant_id) VALUES ('b isolated','tenant b','note',$1) RETURNING id", [tenantB]);
  assert.equal((await scoped(app, tenantA, 'SELECT id FROM desk_entries WHERE id=$1', [b.rows[0].id])).rowCount, 0);
  assert.equal((await scoped(app, tenantB, 'SELECT id FROM desk_entries WHERE id=$1', [a.rows[0].id])).rowCount, 0);
  assert.equal((await app.query('SELECT id FROM desk_entries WHERE id=$1', [a.rows[0].id])).rowCount, 0);
  assert.equal((await scoped(app, tenantA, 'DELETE FROM desk_entries WHERE id=$1 RETURNING id', [b.rows[0].id])).rowCount, 0);
  await assert.rejects(
    scoped(app, tenantA, "INSERT INTO desk_entries(title,detail,status,tenant_id) VALUES ('spoof','spoof','note',$1)", [tenantB]),
    error => error.code === '42501'
  );
  const workerView = await scoped(worker, tenantA, 'SELECT id FROM desk_entries WHERE id=$1', [b.rows[0].id]);
  assert.equal(workerView.rowCount, 0);

  const jobA = await scoped(app, tenantA,
    "INSERT INTO verification_jobs(pull_request_url,repo_owner,repo_name,commit_sha,profile,tenant_id) VALUES ('https://github.com/a/b/pull/1','a','b',$1,'syntax',$2) RETURNING id",
    ['a'.repeat(40), tenantA]);
  assert.equal((await scoped(app, tenantB, 'SELECT id FROM verification_jobs WHERE id=$1', [jobA.rows[0].id])).rowCount, 0);
  assert.equal((await scoped(worker, tenantB, "UPDATE verification_jobs SET status='running' WHERE id=$1 RETURNING id", [jobA.rows[0].id])).rowCount, 0);
  await assert.rejects(
    scoped(app, tenantB, "INSERT INTO verification_jobs(pull_request_url,repo_owner,repo_name,commit_sha,profile,tenant_id) VALUES ('https://github.com/a/b/pull/1','a','b',$1,'syntax',$2)", ['b'.repeat(40), tenantA]),
    error => error.code === '42501'
  );

  const responses = await Promise.all(Array.from({length: 20}, (_, i) =>
    scoped(app, i % 2 ? tenantA : tenantB, 'SELECT count(*)::int AS count FROM desk_entries').then(x => x.rows[0].count)
  ));
  assert(responses.every(n => n === 1));
  const inserted = await scoped(app, tenantA, 'SELECT count(*)::int AS count FROM desk_entries');
  assert.equal(inserted.rows[0].count, 1);
  process.stdout.write(JSON.stringify({
    gate: 'postgres_rls_tenant_cross_access',
    status: 'PASS', tenantChecks: 20,
    policies: policies.rows.map(p => p.relname),
    accounts: principals.rows.map(p => p.rolname)
  }) + '\n');
} finally {
  await Promise.allSettled([app.end(), worker.end(), admin.end()]);
}
