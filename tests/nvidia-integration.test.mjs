import test from 'node:test';
import assert from 'node:assert/strict';
import { nvidiaCapabilities, validateSkillName, resolveSkillDirectory, parseSkillSpectorReport, scanLocalSkill } from '../lib/nvidia-integration.mjs';

test('NVIDIA modules are disabled until explicitly configured', () => {
  const status = nvidiaCapabilities({});
  assert.equal(status.openShell.status, 'disabled');
  assert.equal(status.skillSpector.status, 'disabled');
  assert.equal(status.nemoClaw.status, 'not_integrated');
});

test('skill identifier is a single bounded directory name', () => {
  assert.equal(validateSkillName('trusted-skill_1'), 'trusted-skill_1');
  for (const input of ['../secrets', '.', '..', '/etc', 'a/b', '', 'a'.repeat(97)]) {
    assert.throws(() => validateSkillName(input));
  }
});

test('resolved paths reject symlink escape', async () => {
  const path = await resolveSkillDirectory('/skills', 'safe', async value => value === '/skills' ? '/skills' : '/skills/safe');
  assert.equal(path, '/skills/safe');
  await assert.rejects(resolveSkillDirectory('/skills', 'link', async value => value === '/skills' ? '/skills' : '/etc/secrets'));
});

test('report is fail closed when absent, incomplete, or nonzero', () => {
  assert.throws(() => parseSkillSpectorReport({ stdout: 'not json', exitCode: 0 }));
  assert.throws(() => parseSkillSpectorReport({ stdout: '{}', exitCode: 0, timedOut: true }));
  const bad = parseSkillSpectorReport({ stdout: '{"risk_score":0,"findings":[]}', exitCode: 4 });
  assert.equal(bad.completed, false);
  assert.equal(bad.safeToInstall, false);
  const valid = parseSkillSpectorReport({ stdout: '{"risk_score":17,"findings":[]}', exitCode: 0 });
  assert.equal(valid.completed, true);
  assert.equal(valid.riskScore, 17);
  assert.equal(valid.safeToInstall, false);
});

test('scan executes fixed local static-only arguments, no LLM or shell command', async () => {
  let invoked;
  const result = await scanLocalSkill('review', { NVIDIA_SKILL_SCAN_ENABLED: 'true', NVIDIA_SKILL_ROOT: '/skills' }, {
    realpath: async v => v === '/skills' ? '/skills' : '/skills/review',
    run: async (command, args) => {
      invoked = { command, args };
      return { stdout: '{"risk_score":4,"findings":[]}', exitCode: 0 };
    }
  });
  assert.equal(invoked.command, 'skillspector');
  assert.deepEqual(invoked.args, ['scan', '/skills/review', '--no-llm', '--format', 'json']);
  assert.equal(result.completed, true);
});
