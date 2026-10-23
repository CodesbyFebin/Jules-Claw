import test from 'node:test';
import assert from 'node:assert/strict';
import { localAccessPermitted } from '../lib/access-mode.mjs';

test('loopback-only local operator mode', () => {
  for (const host of ['localhost','127.0.0.1','::1']) assert.equal(localAccessPermitted({}, host), true);
  for (const host of ['jules.example.com','192.168.1.1','0.0.0.0','evil.localhost.example']) assert.equal(localAccessPermitted({}, host), false);
});
test('all hosted and unknown authentication modes fail closed', () => {
  assert.equal(localAccessPermitted({ VERCEL: '1' }, 'localhost'), false);
  assert.equal(localAccessPermitted({ JULES_DEPLOYMENT_MODE: 'multi-user' }, 'localhost'), false);
  assert.equal(localAccessPermitted({ JULES_DEPLOYMENT_MODE: 'oidc' }, 'localhost'), false);
});
