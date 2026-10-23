import { getPool } from '../../../lib/desk';
import { pullRequestEvidence, parseGitHubPullRequestUrl } from '../../../lib/github-evidence';
import { validateVerificationJob } from '../../../lib/verification';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getPool().query(
      'SELECT id, pull_request_url, repo_owner, repo_name, commit_sha, profile, status, cancel_requested, exit_code, stdout, stderr, created_at, started_at, finished_at FROM verification_jobs ORDER BY created_at DESC LIMIT 30'
    );
    return Response.json({ jobs: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : 'Verification storage unavailable' }, { status: e.status || 503 }); }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const problem = validateVerificationJob(body);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    const locator = parseGitHubPullRequestUrl(body.pullRequestUrl);
    const evidence = await pullRequestEvidence(body.pullRequestUrl);
    if (!evidence.sha) return Response.json({ error: 'Missing immutable GitHub commit' }, { status: 502 });
    const result = await getPool().query(
      'INSERT INTO verification_jobs (pull_request_url, repo_owner, repo_name, commit_sha, profile) VALUES ($1,$2,$3,$4,$5) RETURNING id, status, commit_sha, profile',
      [evidence.url, locator.owner, locator.repo, evidence.sha, body.profile]
    );
    return Response.json({ job: result.rows[0] }, { status: 201 });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : (e.status === 400 ? e.message : 'Could not enqueue verification') }, { status: e.status || 502 }); }
}
