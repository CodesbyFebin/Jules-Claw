// Real Chromium -> Next.js -> Better Auth -> PostgreSQL qualification.
// Only run against a disposable local database and CI-only HTTP server.
import assert from 'node:assert/strict';
import pg from 'pg';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';

if (process.env.QUALIFICATION_DISPOSABLE !== 'I_CONFIRM_DISPOSABLE') throw Error('Disposable environment required');
const dbUrl = new URL(process.env.DATABASE_URL || 'postgres://invalid/');
if (dbUrl.hostname !== '127.0.0.1' && dbUrl.hostname !== 'localhost') throw Error('Local-only DB required');
if (dbUrl.pathname !== '/open_web_llm_qualification') throw Error('Wrong qualification database');
const baseURL = 'http://127.0.0.1:3000';
const basicPassword = process.env.OPEN_JULES_PASSWORD;
if (!basicPassword || basicPassword.length < 16) throw Error('CI Basic Auth required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const token = randomUUID().slice(0, 8);
const password = 'browser-ci-password-32@' + token;
const fixtures = [
  { email: 'owner-' + token + '@example.invalid', tenant: '50000000-0000-4000-8000-000000000005', role: 'owner' },
  { email: 'viewer-' + token + '@example.invalid', tenant: '60000000-0000-4000-8000-000000000006', role: 'viewer' },
];
const contexts = [];

async function api(page, method, path, data) {
  return page.evaluate(async ({ method, path, data }) => {
    const response = await fetch(path, { method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { method, path, data });
}
async function newUser(fixture) {
  const context = await browser.newContext({ baseURL, httpCredentials: { username: 'admin', password: basicPassword } });
  contexts.push(context);
  const page = await context.newPage();
  const homepage = await page.goto('/');
  assert.equal(homepage.status(), 200, 'Basic-protected UI reachable');
  const signup = await api(page, 'POST', '/api/auth/sign-up/email', { name: fixture.role, email: fixture.email, password });
  assert.equal(signup.status, 200, JSON.stringify(signup.body));
  assert(signup.body?.user?.id, 'Real browser signup returns user');
  const signin = await api(page, 'POST', '/api/auth/sign-in/email', { email: fixture.email, password });
  assert.equal(signin.status, 200, JSON.stringify(signin.body));
  const cookies = await context.cookies();
  assert(cookies.some(c => c.name.includes('session_token')), 'Browser stores session cookie');
  return { page, userId: signup.body.user.id };
}
try {
  const unauth = await browser.newContext({ baseURL });
  contexts.push(unauth);
  const blocked = await unauth.newPage();
  const noBasic = await blocked.goto('/');
  assert.equal(noBasic.status(), 401, 'Missing Basic credentials blocked');

  const owner = await newUser(fixtures[0]);
  const viewer = await newUser(fixtures[1]);
  await pool.query('INSERT INTO jules_tenants(id) VALUES ($1),($2) ON CONFLICT DO NOTHING', fixtures.map(f => f.tenant));
  await pool.query("INSERT INTO jules_tenant_memberships (tenant_id,user_id,role) VALUES ($1,$2,'owner'),($3,$4,'viewer')",
    [fixtures[0].tenant, owner.userId, fixtures[1].tenant, viewer.userId]);

  const ownerWrite = await api(owner.page, 'POST', '/api/desk', { title: 'browser owner', detail: 'isolated real row', status: 'todo' });
  assert.equal(ownerWrite.status, 201, JSON.stringify(ownerWrite.body));
  const viewerWrite = await api(viewer.page, 'POST', '/api/desk', { title: 'forbidden', detail: 'should not write', status: 'todo' });
  assert.equal(viewerWrite.status, 403, 'Viewer cannot mutate API');
  const ownerRead = await api(owner.page, 'GET', '/api/desk');
  const viewerRead = await api(viewer.page, 'GET', '/api/desk');
  assert.equal(ownerRead.status, 200);
  assert.equal(viewerRead.status, 200);
  assert(ownerRead.body.items.some(x => x.title === 'browser owner'));
  assert(!viewerRead.body.items.some(x => x.title === 'browser owner'), 'No cross-tenant leak');

  // Explicit forged Origin is denied at the real reverse-proxy/Next.js boundary.
  const forged = await fetch(baseURL + '/api/desk', { method: 'POST', headers: {
    authorization: 'Basic ' + Buffer.from('admin:' + basicPassword).toString('base64'),
    origin: 'https://attacker.invalid', 'content-type': 'application/json',
  }, body: JSON.stringify({ title: 'csrf', detail: 'must be rejected', status: 'todo' }) });
  assert.equal(forged.status, 403, 'Cross-origin mutation rejected');

  const signout = await api(owner.page, 'POST', '/api/auth/sign-out', {});
  assert.equal(signout.status, 200);
  const revoked = await api(owner.page, 'GET', '/api/desk');
  assert.equal(revoked.status, 401, 'Revoked session rejected');

  await pool.query('UPDATE session SET "expiresAt" = now() - interval \'1 minute\' WHERE "userId" = $1', [viewer.userId]);
  const expired = await api(viewer.page, 'GET', '/api/desk');
  assert.equal(expired.status, 401, 'Expired browser session rejected');

  process.stdout.write('Chromium HTTP signup/login, cookies, Basic gate, tenant RBAC, Origin denial, signout, expiry: PASS\\n');
} finally {
  await Promise.all(contexts.map(c => c.close()));
  await browser.close();
  await pool.end();
}
