import test from 'node:test';
import assert from 'node:assert/strict';
import { openApprovalDb, requestApproval, decideApproval, consumeApproval, approvalStatus, actionDigest } from '../lib/capability-approvals.mjs';

const action = Object.freeze({ taskId: 'task_1234', capability: 'verify.syntax', sourceSha256: 'a'.repeat(64) });

test('explicit approval binds an exact capability, task and source', () => {
  const db = openApprovalDb(':memory:');
  const request = requestApproval(db, action, 1000);
  assert.equal(consumeApproval(db, request.id, action, 1001), false);
  assert.equal(decideApproval(db, request.id, 'approved', 1002), true);
  assert.equal(consumeApproval(db, request.id, { ...action, sourceSha256: 'b'.repeat(64) }, 1003), false);
  assert.equal(consumeApproval(db, request.id, { ...action, taskId: 'task_5678' }, 1003), false);
  assert.equal(consumeApproval(db, request.id, action, 1003), true);
  assert.equal(consumeApproval(db, request.id, action, 1004), false);
  assert.equal(approvalStatus(db, request.id).state, 'consumed');
  db.close();
});

test('expired and rejected approvals cannot be consumed', () => {
  const db = openApprovalDb(':memory:');
  const expired = requestApproval(db, action, 1000);
  assert.equal(decideApproval(db, expired.id, 'approved', 601001), false);
  const rejected = requestApproval(db, action, 1000);
  assert.equal(decideApproval(db, rejected.id, 'rejected', 1001), true);
  assert.equal(consumeApproval(db, rejected.id, action, 1002), false);
  db.close();
});

test('agent-controlled command, path or unknown capability is rejected', () => {
  assert.throws(() => actionDigest({ ...action, command: 'curl evil' }), /Unexpected/);
  assert.throws(() => actionDigest({ ...action, capability: 'shell.exec' }), /allowlisted/);
  assert.throws(() => actionDigest({ ...action, sourceSha256: 'latest' }), /digest/);
});
