import test from 'node:test';
import assert from 'node:assert/strict';
import { authConfiguration } from '../lib/self-hosted-auth.mjs';

const valid = {
  JULES_AUTH_ENABLED: 'true',
  JULES_DEPLOYMENT_MODE: 'local-single-operator',
  DATABASE_URL: 'postgresql://operator@127.0.0.1:5432/jules',
  BETTER_AUTH_SECRET: 'a'.repeat(40),
  BETTER_AUTH_URL: 'http://127.0.0.1:3000',
};

test('self-hosted identity is explicitly opt-in and local-only', () => {
  assert.equal(authConfiguration(valid).enabled, true);
  for (const override of [
    { JULES_AUTH_ENABLED: 'false' },
    { JULES_DEPLOYMENT_MODE: 'multiuser' },
    { BETTER_AUTH_SECRET: 'short' },
    { DATABASE_URL: 'https://example.test' },
    { BETTER_AUTH_URL: 'https://public.example.test' },
    { BETTER_AUTH_URL: 'http://192.168.1.20:3000' },
  ]) assert.equal(authConfiguration({ ...valid, ...override }).enabled, false);
});
