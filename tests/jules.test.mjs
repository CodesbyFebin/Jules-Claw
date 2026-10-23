import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/jules.js', import.meta.url), 'utf8');
const { sessionId, jules, failure } = await import('data:text/javascript,' + encodeURIComponent(source));

test('normalizes Jules resource names', () => {
  assert.equal(sessionId('sessions/1234567'), '1234567');
  assert.equal(sessionId('1234567'), '1234567');
});

test('rejects invalid session ids', () => {
  for (const value of ['', '../secrets', 'sessions/a/b', 'spaces in id', 'x?z']) {
    assert.throws(() => sessionId(value), /Invalid session resource/);
  }
});

test('requires a Jules key before calling upstream', async () => {
  const original = process.env.JULES_API_KEY;
  delete process.env.JULES_API_KEY;
  try { await assert.rejects(jules('/sessions'), /JULES_API_KEY is not set/); }
  finally { if (original !== undefined) process.env.JULES_API_KEY = original; }
});

test('maps validation errors into a response', async () => {
  const response = failure(Object.assign(new Error('Invalid session resource'), { status: 400 }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid session resource' });
});
