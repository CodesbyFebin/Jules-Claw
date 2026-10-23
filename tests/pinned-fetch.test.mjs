import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import { fetchPinnedSkill } from '../lib/skill-supply-chain.mjs';

const metadata = {
  repository: 'openclaw/agent-skills',
  commit: 'a'.repeat(40),
  path: 'skills/review/SKILL.md',
  license: 'MIT',
};
test('fetches only catalog-approved pinned GitHub Markdown with no redirects', async () => {
  let invoked;
  const report = await fetchPinnedSkill(metadata, {
    fetchImpl: async (url, options) => {
      invoked = { url, options };
      return { ok: true, headers: { get: () => '14' }, body: new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('# Review skill')); controller.close(); }
      }) };
    }
  });
  assert.equal(invoked.url, 'https://raw.githubusercontent.com/openclaw/agent-skills/' + 'a'.repeat(40) + '/skills/review/SKILL.md');
  assert.equal(invoked.options.redirect, 'error');
  assert.equal(report.installed, false);
  assert.equal(report.decision, 'requires_human_review');
});
test('refuses unsafe or unapproved upstream sources before any fetch', async () => {
  let called = false;
  for (const patch of [{ commit: 'main' }, { repository: 'random/unknown' }, { path: '../secret.md' }]) {
    await assert.rejects(fetchPinnedSkill({ ...metadata, ...patch }, { fetchImpl: async () => { called = true; } }));
  }
  assert.equal(called, false);
});
