import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeQuota } from '../lib/quotas.js';

test('quota uses atomic SQL and fixed window buckets', async () => {
  const calls = [];
  const pool = { query: async (sql, args) => {
    calls.push({ sql, args });
    return { rowCount: calls.length < 3 ? 1 : 0, rows: calls.length < 3 ? [{ used: calls.length }] : [] };
  } };
  const now = new Date('2026-10-23T10:14:42Z');
  assert.equal((await consumeQuota(pool, 'verify_enqueue', 2, 3600, now)).allowed, true);
  assert.equal((await consumeQuota(pool, 'verify_enqueue', 2, 3600, now)).used, 2);
  assert.equal((await consumeQuota(pool, 'verify_enqueue', 2, 3600, now)).allowed, false);
  assert.equal(calls[0].args[1].toISOString(), '2026-10-23T10:00:00.000Z');
  assert.match(calls[0].sql, /ON CONFLICT/);
});

test('rejects unbounded quota operation and limits', async () => {
  const pool = { query: async () => { throw new Error('should not query'); } };
  await assert.rejects(consumeQuota(pool, 'a/b', 1));
  await assert.rejects(consumeQuota(pool, 'a', 0));
  await assert.rejects(consumeQuota(pool, 'a', 1, 1));
});
