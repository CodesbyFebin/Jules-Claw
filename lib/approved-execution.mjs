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

  // The digest must be measured *inside* the sandbox, never asserted by an agent.
  // A sandbox must be provisioned with a read-only immutable /workspace/target.mjs.
  let check;
  try { check = await run('sha256-target', { env: environment }); }
  catch (error) {
    appendExecutionEvent(db, approvalId, 'preflight_failed', { reason: 'sandbox_unavailable' }, now());
    throw error;
  }
  const match = typeof check.stdout === 'string' && /^([0-9a-f]{64})\s+\/workspace\/target\.mjs\s*$/.exec(check.stdout);
  if (!check.passed || !match || match[1] !== action.sourceSha256) {
    appendExecutionEvent(db, approvalId, 'preflight_failed', { reason: 'source_attestation_mismatch' }, now());
    return { started: false, reason: 'Sandbox source did not match approval digest' };
  }
  // Approval is consumed atomically before invoking any executable profile.
  if (!consumeApproval(db, approvalId, action, now())) return { started: false, reason: 'Approval absent, expired, mismatched or consumed' };
  appendExecutionEvent(db, approvalId, 'started', { capability: action.capability, sourceSha256: action.sourceSha256 }, now());
  try {
    const result = await run('syntax', { env: environment });
    appendExecutionEvent(db, approvalId, result.passed ? 'completed' : 'failed', {
      exitCode: result.exitCode, timedOut: !!result.timedOut, truncated: !!result.truncated,
    }, now());
    return { started: true, passed: result.passed === true, exitCode: result.exitCode, timedOut: !!result.timedOut, truncated: !!result.truncated };
  } catch (error) {
    appendExecutionEvent(db, approvalId, 'failed', { reason: 'sandbox_invocation_error' }, now());
    throw error;
  }
}
