import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../lib/swarm.js', import.meta.url), 'utf8');
const { validateSwarmRequest, swarmConfiguration } = await import('data:text/javascript,' + encodeURIComponent(source));

test('requires bounded prompt and explicit usage approval', () => {
  assert.equal(validateSwarmRequest({ prompt: 'Review this code', confirmCost: true }), null);
  assert.match(validateSwarmRequest({ prompt: ' ', confirmCost: true }), /Prompt/);
  assert.match(validateSwarmRequest({ prompt: 'Hello', confirmCost: false }), /confirmation/);
});

test('fails closed on missing model credentials', () => {
  assert.equal(swarmConfiguration({ SWARM_ENABLED: 'true', GATEWAY_BASE_URL: 'https://gateway.example/v1' }), null);
  assert.equal(swarmConfiguration({ SWARM_ENABLED: 'false' }), null);
});

test('accepts explicit six-role config only', () => {
  const env = { SWARM_ENABLED: 'true', GATEWAY_BASE_URL: 'https://gateway.example/v1', GATEWAY_API_KEY: 'private' };
  for (const role of ['ARCHITECT','CODER','DEBUGGER','SECURITY','VERIFIER','MANAGER']) env['SWARM_MODEL_' + role] = 'model-' + role;
  assert.equal(swarmConfiguration(env).models.manager, 'model-MANAGER');
});
