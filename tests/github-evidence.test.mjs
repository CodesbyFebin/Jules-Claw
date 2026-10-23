import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../lib/github-evidence.js', import.meta.url), 'utf8');
const { parseGitHubPullRequestUrl, summarizeCheckRuns } = await import('data:text/javascript,' + encodeURIComponent(source));

test('parses allowed pull request paths', () => {
  assert.deepEqual(parseGitHubPullRequestUrl('https://github.com/CodesbyFebin/Open-Jules/pull/1'),
    { owner: 'CodesbyFebin', repo: 'Open-Jules', number: 1 });
});

test('flags incomplete GitHub check-run pagination', () => {
  const summary = summarizeCheckRuns({ total_count: 101, check_runs: [{ id: 1, name: 'CI', status: 'completed', conclusion: 'success' }] });
  assert.equal(summary.checksComplete, false);
  assert.equal(summary.unreportedChecks, 100);
  assert.equal(summarizeCheckRuns({ total_count: 1, check_runs: [{id: 1}] }).checksComplete, true);
  assert.equal(summarizeCheckRuns({ check_runs: [] }).checksComplete, false);
});

test('refuses non-GitHub URLs and ambiguous paths', () => {
  for (const url of [
    'http://github.com/a/b/pull/1',
    'https://github.com.evil.test/a/b/pull/1',
    'https://github.com/a/b/issues/1',
    'https://github.com/a/b/pull/1?x=1',
    'https://github.com@evil.test/a/b/pull/1',
    'https://github.com/a/b/pull/0',
    'https://github.com/a/b/pull/99999999999999999999999',
  ]) assert.throws(() => parseGitHubPullRequestUrl(url));
});
