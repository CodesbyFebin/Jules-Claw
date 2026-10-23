import test from 'node:test';
import assert from 'node:assert/strict';
import { openMemory, remember, recall, forget, validateMemory } from '../lib/local-memory.mjs';
import { capabilityState, CAPABILITY } from '../lib/capability-state.mjs';
import { localModelConfig } from '../lib/gateway-failover.js';

test('local memory persists revisions and supports erasure', () => {
  const db = openMemory(':memory:');
  const item = { key: 'user.language', value: 'English', source: 'user-confirmed', confidence: 0.9 };
  const first = remember(db, item);
  const second = remember(db, { ...item, value: 'Malayalam' });
  assert.equal(first.id, second.id);
  assert.equal(recall(db, 'Malay')[0].value, 'Malayalam');
  assert.equal(db.prepare('SELECT count(*) AS n FROM memory_revisions').get().n, 2);
  assert.equal(forget(db, first.id), true);
  assert.equal(recall(db).length, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM memory_revisions').get().n, 0);
  db.close();
});

test('invalid and untrusted memories are rejected', () => {
  assert.match(validateMemory({ key: 'x', value: 'x', source: '', confidence: 1 }), /Source/);
  assert.match(validateMemory({ key: '../private', value: 'x', source: 'user', confidence: 1 }), /key/);
  assert.match(validateMemory({ key: 'ok', value: 'x', source: 'web', confidence: 9 }), /Confidence/);
});

test('capability ladder fails closed and prioritizes host health', () => {
  const healthy = { freeBytes: 4e9, totalBytes: 16e9, load: 1, cores: 8, diskFreeBytes: 4e9, localAvailable: true, remoteAvailable: true };
  assert.equal(capabilityState(healthy).level, CAPABILITY.FULL);
  assert.equal(capabilityState({ ...healthy, remoteAvailable: false }).level, CAPABILITY.LOCAL);
  assert.equal(capabilityState({ ...healthy, freeBytes: 500e6 }).level, CAPABILITY.READ_ONLY);
  assert.equal(capabilityState({ ...healthy, freeBytes: 10e6 }).level, CAPABILITY.HALT);
  assert.equal(capabilityState({ ...healthy, diskFreeBytes: NaN }).level, CAPABILITY.HALT);
});

test('local provider cannot send requests to public or authenticated hosts', () => {
  assert.throws(() => localModelConfig({ JULES_LOCAL_LLM_URL: 'https://example.com/v1', JULES_LOCAL_LLM_MODEL: 'qwen' }));
  assert.throws(() => localModelConfig({ JULES_LOCAL_LLM_URL: 'http://127.0.0.1@evil.example/v1', JULES_LOCAL_LLM_MODEL: 'qwen' }));
  assert.equal(localModelConfig({ JULES_LOCAL_LLM_URL: 'http://127.0.0.1:11434/v1', JULES_LOCAL_LLM_MODEL: 'qwen' }).model, 'qwen');
});
