import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const original = await readFile(new URL('../lib/desk.js', import.meta.url), 'utf8');
const stripped = original.replace("import pg from 'pg';", '').replace(/export function getPool\(\) \{[\s\S]*?\n\}\n\n/, '');
const { validateDesk } = await import('data:text/javascript,' + encodeURIComponent(stripped));

test('accepts bounded journal entry', () => {
  assert.equal(validateDesk({ title: 'CI report', detail: 'Run link and commit SHA', status: 'note' }), null);
});

test('rejects invalid and misleading statuses', () => {
  assert.match(validateDesk({ title: 'x', detail: 'y', status: 'verified' }), /Invalid status/);
  assert.match(validateDesk({ title: '', detail: 'y', status: 'note' }), /Title/);
  assert.match(validateDesk({ title: 'x', detail: '', status: 'note' }), /Detail/);
});
