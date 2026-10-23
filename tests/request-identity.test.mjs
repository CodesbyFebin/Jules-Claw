import test from 'node:test';
import assert from 'node:assert/strict';
import { requestIdentity, assertPermission } from '../lib/request-identity.mjs';
import { LOCAL_TENANT } from '../lib/tenant-db.mjs';

const envNames = ['JULES_AUTH_ENABLED', 'JULES_DEPLOYMENT_MODE', 'BETTER_AUTH_SECRET', 'DATABASE_URL', 'BETTER_AUTH_URL'];
function withIdentityMode(fn) {
  const prior = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  Object.assign(process.env, {
    JULES_AUTH_ENABLED: 'true', JULES_DEPLOYMENT_MODE: 'local-single-operator',
    BETTER_AUTH_SECRET: 'a'.repeat(48), DATABASE_URL: 'postgresql://localhost/test',
    BETTER_AUTH_URL: 'http://127.0.0.1:3000',
  });
  return Promise.resolve().then(fn).finally(() => {
    for (const k of envNames) if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k];
  });
}

test('verified session and database membership determine identity, not forged headers', () => withIdentityMode(async () => {
  const headers = new Headers({ 'x-tenant-id': '00000000-0000-4000-8000-000000000099', 'x-user-id': 'attacker' });
  const identity = await requestIdentity({ headers }, {
    getAuth: async () => ({ api: { getSession: async () => ({ user: { id: 'trusted' } }) } }),
    membershipLookup: async id => { assert.equal(id, 'trusted'); return { tenantId: LOCAL_TENANT, role: 'viewer' }; },
  });
  assert.equal(identity.tenantId, LOCAL_TENANT);
  assertPermission(identity, 'read');
  assert.throws(() => assertPermission(identity, 'write'), /Forbidden/);
}));

test('missing session or membership fails closed', () => withIdentityMode(async () => {
  const request = { headers: new Headers() };
  await assert.rejects(requestIdentity(request, { getAuth: async () => ({ api: { getSession: async () => null } }) }), e => e.status === 401);
  await assert.rejects(requestIdentity(request, { getAuth: async () => ({ api: { getSession: async () => ({ user: { id: 'u' } }) } }), membershipLookup: async () => null }), e => e.status === 403);
}));
