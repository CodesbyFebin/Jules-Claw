import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { consumeQuota } from '../lib/quotas.js';

test('real PostgreSQL-compatible engine enforces quota during simultaneous requests', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE request_quotas (
      operation text NOT NULL,
      window_start timestamptz NOT NULL,
      used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
      PRIMARY KEY(operation,window_start)
    )`);
    const instant = new Date('2026-10-23T12:01:01Z');
    const results = await Promise.all(Array.from({ length: 64 }, () =>
      consumeQuota(db, 'verify_enqueue', 7, 3600, instant)));
    assert.equal(results.filter(result => result.allowed).length, 7);
    assert.equal(results.filter(result => !result.allowed).length, 57);
    const rows = await db.query('SELECT used FROM request_quotas WHERE operation=$1', ['verify_enqueue']);
    assert.equal(rows.rows[0].used, 7);

    // An independent operation cannot borrow or exhaust the other bucket.
    assert.equal((await consumeQuota(db, 'gateway_chat', 2, 3600, instant)).allowed, true);
    assert.equal((await consumeQuota(db, 'gateway_chat', 2, 3600, instant)).allowed, true);
    assert.equal((await consumeQuota(db, 'gateway_chat', 2, 3600, instant)).allowed, false);
    assert.equal((await consumeQuota(db, 'verify_enqueue', 7, 3600, instant)).allowed, false);
  } finally {
    await db.close();
  }
});

test('quota fails closed when the database errors', async () => {
  const unavailable = { query: async () => { throw new Error('database unavailable'); } };
  await assert.rejects(consumeQuota(unavailable, 'verify_enqueue', 10), /database unavailable/);
});
