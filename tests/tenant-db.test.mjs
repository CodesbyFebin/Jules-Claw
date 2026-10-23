import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_TENANT, validateTenantId, withTenantTransaction } from '../lib/tenant-db.mjs';

test('verified UUID required; forged caller input cannot be used as an implicit tenant', async () => {
  assert.equal(validateTenantId(LOCAL_TENANT), LOCAL_TENANT);
  for (const invalid of [undefined, null, '', 'some-user', '../../other', '00000000-0000-0000-0000-000000000000']) {
    assert.throws(() => validateTenantId(invalid));
  }
});

test('transaction sets a local tenant before queries and always releases the connection', async () => {
  const calls = [];
  const client = {
    query: async (sql, args) => { calls.push([sql, args]); return { rows: [{ ok: true }] }; },
    release: () => calls.push(['release']),
  };
  const pool = { connect: async () => client };
  const output = await withTenantTransaction(pool, LOCAL_TENANT, db => db.query('SELECT 1'));
  assert.deepEqual(output.rows, [{ ok: true }]);
  assert.deepEqual(calls.map(([sql]) => sql), ['BEGIN', "SELECT set_config('jules.tenant_id',$1,true)", 'SELECT 1', 'COMMIT', 'release']);
  assert.deepEqual(calls[1][1], [LOCAL_TENANT]);
});

test('failed tenant-scoped query rolls back and releases without committing', async () => {
  const calls = [];
  const client = {
    query: async sql => { calls.push(sql); if (sql === 'SELECT sensitive') throw new Error('query denied'); return {}; },
    release: () => calls.push('release'),
  };
  await assert.rejects(withTenantTransaction({ connect: async () => client }, LOCAL_TENANT, db => db.query('SELECT sensitive')), /query denied/);
  assert.deepEqual(calls, ['BEGIN', "SELECT set_config('jules.tenant_id',$1,true)", 'SELECT sensitive', 'ROLLBACK', 'release']);
});
