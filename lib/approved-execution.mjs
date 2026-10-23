import { consumeApproval, appendExecutionEvent, approvalStatus, actionDigest } from './capability-approvals.mjs';
import { runOpenShellProfile } from './openshell-adapter.mjs';

/**
 * Execute only a pinned syntax check in an already-provisioned sandbox.
 * This is a limited adapter; it does not attest sandbox isolation or provision mounts.
 */
export async function executeApprovedSyntax(db, request, options = {}) {
  const { approvalId, action } = request || {};
  if (typeof approvalId !== 'string' || !/^[0-9a-f-]{36}$/.test(approvalId)) throw Error('Invalid approval ID');
  if (action?.capability !== 'verify.syntax') throw Error('Only syntax capability is executable');
  const run = options.runProfile || runOpenShellProfile;
  const environment = options.env || process.env;
  const now = options.now || (() => Date.now());

  const prior = approvalStatus(db, approvalId);
  if (!prior || prior.state !== 'approved' || prior.expires_at <= now() || prior.action_digest !== actionDigest(action))
    return { started: false, reason: 'Approval absent, expired, mismatched or consumed' };

  // Approval is consumed before ANY sandbox invocation. The fixed profile
  // performs digest verification and parse on identical bytes in one process.
  if (!consumeApproval(db, approvalId, action, now())) return { started: false, reason: 'Approval absent, expired, mismatched or consumed' };
  appendExecutionEvent(db, approvalId, 'started', { capability: action.capability, sourceSha256: action.sourceSha256 }, now());
  try {
    const result = await run('pinned-syntax', { env: environment, sourceSha256: action.sourceSha256 });
    const verified = result.passed === true && result.stdout?.trim() === `JULES_PINNED_SYNTAX_OK ${action.sourceSha256}`;
    appendExecutionEvent(db, approvalId, verified ? 'completed' : 'failed', {
      exitCode: result.exitCode, timedOut: !!result.timedOut, truncated: !!result.truncated,
    }, now());
    return { started: true, passed: verified, exitCode: result.exitCode, timedOut: !!result.timedOut, truncated: !!result.truncated };
  } catch (error) {
    appendExecutionEvent(db, approvalId, 'failed', { reason: 'sandbox_invocation_error' }, now());
    throw error;
  }
}
