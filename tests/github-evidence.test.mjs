import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../lib/github-evidence.js', import.meta.url), 'utf8');
const { parseGitHubPullRequestUrl } = await import('data:text/javascript,' + encodeURIComponent(source));

test('parses allowed pull request paths', () => {
  assert.deepEqual(parseGitHubPullRequestUrl('https://github.com/CodesbyFebin/Open-Jules/pull/1'),
    { owner: 'CodesbyFebin', repo: 'Open-Jules', number: 1 });
});

test('refuses non-GitHub URLs and ambiguous paths', () => {
  for (const url of [
    'http://github.com/a/b/pull/1',
    'https://github.com.evil.test/a/b/pull/1',
    'https://github.com/a/b/issues/1',
    'https://github.com/a/b/pull/1?x=1',
    'https://github.com@evil.test/a/b/pull/1',
  ]) assert.throws(() => parseGitHubPullRequestUrl(url));
});
