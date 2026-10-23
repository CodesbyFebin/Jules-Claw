#!/usr/bin/env node
import { openApprovalDb } from '../lib/capability-approvals.mjs';
import { executeApprovedSyntax } from '../lib/approved-execution.mjs';

// No HTTP execution endpoint. The command is a local operator-controlled service action.
const id = process.argv[2];
if (process.env.JULES_APPROVED_EXECUTION_ENABLED !== 'true' || !/^[0-9a-f-]{36}$/.test(id || '')) {
  process.stderr.write('Execution disabled. Requires JULES_APPROVED_EXECUTION_ENABLED=true and approval UUID.\n');
  process.exitCode = 2;
} else {
  const db = openApprovalDb();
  try {
    const record = db.prepare('SELECT action_json FROM approvals WHERE id=?').get(id);
    if (!record) throw Error('Approval not found');
    const result = await executeApprovedSyntax(db, { approvalId: id, action: JSON.parse(record.action_json) });
    process.stdout.write(JSON.stringify(result) + '\n');
    if (!result.started || !result.passed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`Execution failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally { db.close(); }
}
