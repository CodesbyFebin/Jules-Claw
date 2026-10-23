import test from 'node:test';
import assert from 'node:assert/strict';
import { openApprovalDb, requestApproval, decideApproval, verifyExecutionChain } from '../lib/capability-approvals.mjs';
import { executeApprovedSyntax } from '../lib/approved-execution.mjs';

const action = { taskId: 'test_task_01', capability: 'verify.syntax', sourceSha256: 'a'.repeat(64) };

function fixture() {
  const db = openApprovalDb(':memory:');
  const req = requestApproval(db, action, 1000);
  return { db, id: req.id };
}

function runner(log, source = action.sourceSha256, pass = true) {
  return async (profile, opts) => {
    log.push(profile);
    assert.equal(opts.sourceSha256, action.sourceSha256);
    return { passed: pass && source === opts.sourceSha256, stdout: pass && source === opts.sourceSha256 ? `JULES_PINNED_SYNTAX_OK ${source}\n` : '', exitCode: pass && source === opts.sourceSha256 ? 0 : 66, timedOut: false, truncated: false };
  };
}

test('no approval never runs executable action and produces a valid audit chain', async () => {
  const { db, id } = fixture();
  const calls = [];
  const result = await executeApprovedSyntax(db, { approvalId: id, action }, { runProfile: runner(calls), now: () => 1001 });
  assert.equal(result.started, false);
  assert.deepEqual(calls, []);
  assert.equal(verifyExecutionChain(db), true);
  db.close();
});

test('approved exact bytes execute once; replay denied', async () => {
  const { db, id } = fixture();
  decideApproval(db, id, 'approved', 1001);
  const calls = [];
  const opts = { runProfile: runner(calls), now: () => 1002 };
  const ok = await executeApprovedSyntax(db, { approvalId: id, action }, opts);
  assert.deepEqual([ok.started, ok.passed], [true, true]);
  assert.deepEqual(calls, ['pinned-syntax']);
  const again = await executeApprovedSyntax(db, { approvalId: id, action }, opts);
  assert.equal(again.started, false);
  assert.equal(calls.filter(x => x === 'pinned-syntax').length, 1);
  assert.equal(verifyExecutionChain(db), true);
  db.close();
});

test('source mismatch, action mutation, expiry and unsupported capability deny execution', async () => {
  const { db, id } = fixture();
  decideApproval(db, id, 'approved', 1001);
  let calls = [];
  const mismatch = await executeApprovedSyntax(db, { approvalId: id, action }, { runProfile: runner(calls, 'b'.repeat(64)), now: () => 1002 });
  assert.equal(mismatch.started, true);
  assert.equal(mismatch.passed, false);
  assert.deepEqual(calls, ['pinned-syntax']);
  calls = [];
  const second = requestApproval(db, action, 1000);
  decideApproval(db, second.id, 'approved', 1001);
  const changed = await executeApprovedSyntax(db, { approvalId: second.id, action: { ...action, taskId: 'changed_task_2' } }, { runProfile: runner(calls), now: () => 1002 });
  assert.equal(changed.started, false);
  assert.deepEqual(calls, []);
  const expired = await executeApprovedSyntax(db, { approvalId: second.id, action }, { runProfile: runner([]), now: () => 601002 });
  assert.equal(expired.started, false);
  await assert.rejects(executeApprovedSyntax(db, { approvalId: id, action: { ...action, capability: 'verify.node-tests' } }), /Only syntax/);
  db.close();
});

test('nonzero sandbox status records a failure; audit tampering is detectable', async () => {
  const { db, id } = fixture();
  decideApproval(db, id, 'approved', 1001);
  const result = await executeApprovedSyntax(db, { approvalId: id, action }, { runProfile: runner([], action.sourceSha256, false), now: () => 1002 });
  assert.equal(result.passed, false);
  assert.equal(verifyExecutionChain(db), true);
  db.prepare("UPDATE execution_events SET event='completed' WHERE event='failed'").run();
  assert.equal(verifyExecutionChain(db), false);
  db.close();
});
