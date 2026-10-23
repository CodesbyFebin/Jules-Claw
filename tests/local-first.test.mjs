import test from 'node:test';
import assert from 'node:assert/strict';
import { openMemory, openMemoryForTenant, remember, recall, forget, validateMemory } from '../lib/local-memory.mjs';
import { LOCAL_TENANT } from '../lib/tenant-db.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('tenant memory is physically separated with independent WAL and revisions', () => {
  const folder = mkdtempSync(join(tmpdir(), 'open-web-llm-tenant-'));
  const file = join(folder, 'memory.sqlite');
  const otherTenant = '00000000-0000-4000-8000-000000000002';
  try {
    const first = openMemoryForTenant(LOCAL_TENANT, file);
    const second = openMemoryForTenant(otherTenant, file);
    remember(first, { key: 'secret', value: 'alpha-private', source: 'owner', confidence: 1 });
    remember(second, { key: 'secret', value: 'beta-private', source: 'owner', confidence: 1 });
    assert.equal(recall(first, 'beta-private').length, 0);
    assert.equal(recall(second, 'alpha-private').length, 0);
    assert.equal(recall(first, 'secret')[0].value, 'alpha-private');
    assert.equal(recall(second, 'secret')[0].value, 'beta-private');
    first.close(); second.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
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
