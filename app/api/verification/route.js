import { getPool } from '../../../lib/desk';
import { pullRequestEvidence, parseGitHubPullRequestUrl } from '../../../lib/github-evidence';
import { validateVerificationJob } from '../../../lib/verification';
import { consumeQuota } from '../../../lib/quotas';
import { requestIdentity, assertPermission } from '../../../lib/request-identity.mjs';
import { withTenantTransaction } from '../../../lib/tenant-db.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const identity = assertPermission(await requestIdentity(request), 'read');
    const result = await withTenantTransaction(getPool(), identity.tenantId, client => client.query(
      'SELECT id, pull_request_url, repo_owner, repo_name, commit_sha, profile, status, cancel_requested, attempts, heartbeat_at, exit_code, stdout, stderr, created_at, started_at, finished_at FROM verification_jobs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 30', [identity.tenantId]
    ));
    return Response.json({ jobs: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : 'Verification storage unavailable' }, { status: e.status || 503 }); }
}

export async function POST(request) {
  try {
    const identity = assertPermission(await requestIdentity(request), 'execute');
    const body = await request.json();
    const problem = validateVerificationJob(body);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    // One global operator budget until real per-user identities are available.
    const quota = await consumeQuota(getPool(), 'verify_enqueue_' + identity.tenantId.replaceAll('-', ''), 30);
    if (!quota.allowed) return Response.json({ error: 'Shared verification quota exceeded', quota }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
    parseGitHubPullRequestUrl(body.pullRequestUrl);
    const evidence = await pullRequestEvidence(body.pullRequestUrl);
    if (evidence.headRepositoryPrivate) return Response.json({ error: 'Private head repositories are not supported by this public-repository verifier' }, { status: 422 });
    const [owner, repo] = (evidence.headRepository || '').split('/');
    if (!owner || !repo || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return Response.json({ error: 'Unable to resolve public head repository' }, { status: 422 });
    if (!evidence.sha) return Response.json({ error: 'Missing immutable GitHub commit' }, { status: 502 });
    const result = await withTenantTransaction(getPool(), identity.tenantId, client => client.query(
      'INSERT INTO verification_jobs (pull_request_url, repo_owner, repo_name, commit_sha, profile, tenant_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status, commit_sha, profile',
      [evidence.url, owner, repo, evidence.sha, body.profile, identity.tenantId]
    ));
    return Response.json({ job: result.rows[0] }, { status: 201 });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : (e.status === 400 ? e.message : 'Could not enqueue verification') }, { status: e.status || 502 }); }
}
