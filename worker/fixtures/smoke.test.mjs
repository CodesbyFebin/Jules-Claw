import test from 'node:test';
import assert from 'node:assert/strict';

test('isolated Node test runner executes actual assertions', () => {
  assert.equal(2 + 2, 4);
});
