import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../lib/verification.js', import.meta.url), 'utf8');
const { validateVerificationJob, validateJobId } = await import('data:text/javascript,' + encodeURIComponent(source));

test('accepts only fixed profiles', () => {
  assert.equal(validateVerificationJob({ pullRequestUrl: 'https://github.com/a/b/pull/1', profile: 'syntax' }), null);
  assert.equal(validateVerificationJob({ pullRequestUrl: 'https://github.com/a/b/pull/1', profile: 'node-tests' }), null);
  assert.match(validateVerificationJob({ pullRequestUrl: 'https://github.com/a/b/pull/1', profile: 'shell' }), /Unsupported/);
});

test('validates opaque job identifiers', () => {
  assert.equal(validateJobId('f3474fcb-4313-4f55-817f-9ad7c10f85ea'), true);
  assert.equal(validateJobId('../other'), false);
  assert.equal(validateJobId('test'), false);
});
