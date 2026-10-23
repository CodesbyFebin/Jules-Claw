#!/usr/bin/env node
// Human decisions are accepted only from an interactive local terminal.
// There is intentionally no remotely callable HTTP approval endpoint.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { openApprovalDb, approvalStatus, decideApproval } from '../lib/capability-approvals.mjs';

const id = process.argv[2];
if (!stdin.isTTY || !stdout.isTTY || !/^[0-9a-f-]{36}$/.test(id || '')) {
  process.stderr.write('Usage (local interactive terminal): npm run approval -- <request-uuid>\n');
  process.exitCode = 2;
} else {
  const db = openApprovalDb();
  const entry = approvalStatus(db, id);
  if (!entry || entry.state !== 'pending' || entry.expires_at <= Date.now()) {
    process.stderr.write('Approval is absent, expired or already decided.\n');
    process.exitCode = 1;
  } else {
    const action = db.prepare('SELECT action_json FROM approvals WHERE id=?').get(id)?.action_json;
    stdout.write(`Requested action: ${action}\nDigest: ${entry.action_digest}\nExpires: ${new Date(entry.expires_at).toISOString()}\n`);
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      const answer = await prompt.question('Type APPROVE to allow exactly this action; anything else rejects: ');
      const decision = answer === 'APPROVE' ? 'approved' : 'rejected';
      stdout.write(decideApproval(db, id, decision) ? `${decision}\n` : 'Approval no longer available\n');
    } finally { prompt.close(); }
  }
  db.close();
}
