// Real Better Auth backend session and tenant-membership qualification on disposable PostgreSQL.
// Exercises the actual self-hosted auth handler and requestIdentity, not mocked session objects.
import assert from 'node:assert/strict';
import pg from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { selfHostedAuth } from '../lib/self-hosted-auth.mjs';
import { requestIdentity, assertPermission } from '../lib/request-identity.mjs';
import { randomUUID } from 'node:crypto';

if (process.env.QUALIFICATION_DISPOSABLE !== 'I_CONFIRM_DISPOSABLE') throw Error('Disposable auth qualification only');
if (new URL(process.env.DATABASE_URL || 'postgres://bad/').pathname !== '/open_web_llm_qualification') throw Error('Disposable database mismatch');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const auth = await selfHostedAuth();
const schema = await getMigrations(auth.options);
await schema.runMigrations();
const origin = 'http://127.0.0.1:3000';
const suffix = randomUUID().slice(0,8);
const emailA = 'owner-' + suffix + '@example.invalid';
const emailB = 'viewer-' + suffix + '@example.invalid';
const password = 'only-ci-test-secret-89@' + suffix;

async function post(path, data, cookie = '') {
  const response = await auth.handler(new Request(origin + '/api/auth/' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(data),
  }));
  const result = await response.json().catch(()=>({}));
  if (!response.ok) throw Error('Auth endpoint ' + path + ' returned HTTP ' + response.status + ': ' + JSON.stringify(result).slice(0,300));
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(/(?:^|[, ]+)(better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
  return { result, cookie: match ? match[1] + '=' + match[2] : '' };
}
function req(cookie, forgedTenant) {
  return { headers: new Headers({ cookie, ...(forgedTenant ? {'x-tenant-id': forgedTenant} : {}) }) };
}

try {
  const a = await post('sign-up/email', { name: 'CI Owner', email: emailA, password });
  const b = await post('sign-up/email', { name: 'CI Viewer', email: emailB, password });
  assert(a.result.user?.id && b.result.user?.id);
  assert.notEqual(a.result.user.id, b.result.user.id);
  const loginA = await post('sign-in/email', { email: emailA, password });
  const loginB = await post('sign-in/email', { email: emailB, password });
  assert(loginA.cookie && loginB.cookie);

  await pool.query('INSERT INTO jules_tenants(id) VALUES ($1),($2) ON CONFLICT DO NOTHING',
    ['30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004']);
  await pool.query("INSERT INTO jules_tenant_memberships(tenant_id,user_id,role) VALUES ($1,$2,'owner'),($3,$4,'viewer')", [
    '30000000-0000-4000-8000-000000000003', a.result.user.id,
    '40000000-0000-4000-8000-000000000004', b.result.user.id
  ]);

  const idA = await requestIdentity(req(loginA.cookie, '40000000-0000-4000-8000-000000000004'));
  const idB = await requestIdentity(req(loginB.cookie, '30000000-0000-4000-8000-000000000003'));
  assert.equal(idA.tenantId, '30000000-0000-4000-8000-000000000003');
  assert.equal(idB.tenantId, '40000000-0000-4000-8000-000000000004');
  assertPermission(idA,'write');
  assert.throws(()=>assertPermission(idB,'write'), e=>e.status === 403);
  await assert.rejects(requestIdentity(req('')), e=>e.status === 401);

  await post('sign-out', {}, loginA.cookie);
  await assert.rejects(requestIdentity(req(loginA.cookie)), e=>e.status === 401);

  // Database-enforced session expiration, without waiting days or weakening configured TTL.
  const fresh = await post('sign-in/email', { email: emailB, password });
  assert(fresh.cookie);
  const active = await requestIdentity(req(fresh.cookie));
  assert.equal(active.userId, b.result.user.id);
  await pool.query('UPDATE session SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId"=$1', [b.result.user.id]);
  await assert.rejects(requestIdentity(req(fresh.cookie)), e=>e.status === 401);
  process.stdout.write('Better Auth signup, login, forged tenant denial, role checks, signout revocation, database expiry: PASS (backend handler)\n');
} finally {
  await pool.end();
  // Better Auth owns a separate pg.Pool. Close it so CI does not idle until timeout.
  if (typeof auth.options.database?.end === 'function') await auth.options.database.end();
}
