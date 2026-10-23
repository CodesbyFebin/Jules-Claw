export function parseGitHubPullRequestUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw Object.assign(new Error('Invalid pull request URL'), { status: 400 }); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('Only GitHub pull request URLs are accepted'), { status: 400 });
  }
  const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)\/?$/);
  if (!match) throw Object.assign(new Error('Invalid GitHub pull request path'), { status: 400 });
  const number = Number(match[3]);
  if (!Number.isSafeInteger(number) || number < 1) throw Object.assign(new Error('Invalid GitHub pull request number'), { status: 400 });
  return { owner: match[1], repo: match[2], number };
}

async function github(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.github.com' + path, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Open-Jules-Evidence',
        ...(process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}),
      },
    });
    if (!response.ok) throw Object.assign(new Error('GitHub API unavailable or access denied'), { status: response.status });
    return response.json();
  } finally { clearTimeout(timer); }
}

export function summarizeCheckRuns(checks) {
  const runs = Array.isArray(checks?.check_runs) ? checks.check_runs : [];
  const total = Number.isSafeInteger(checks?.total_count) && checks.total_count >= 0 ? checks.total_count : null;
  return {
    checks: runs.map(c => ({ id: c.id, name: c.name, status: c.status, conclusion: c.conclusion,
      url: c.html_url, started_at: c.started_at, completed_at: c.completed_at })),
    totalChecks: total,
    checksComplete: total !== null && total <= runs.length,
    unreportedChecks: total === null ? null : Math.max(0, total - runs.length),
  };
}

export async function pullRequestEvidence(url) {
  const { owner, repo, number } = parseGitHubPullRequestUrl(url);
  const base = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo);
  const pr = await github(base + '/pulls/' + number);
  const sha = pr.head?.sha;
  if (!sha || !/^[a-f0-9]{40}$/.test(sha)) throw Object.assign(new Error('GitHub did not return a valid PR head'), { status: 502 });
  const [checks, statuses] = await Promise.all([
    github(base + '/commits/' + sha + '/check-runs?per_page=100'),
    github(base + '/commits/' + sha + '/status'),
  ]);
  const checkSummary = summarizeCheckRuns(checks);
  const headRepository = pr.head?.repo?.full_name || null;
  const headRepositoryPrivate = !!pr.head?.repo?.private;
  return {
    url: pr.html_url, sha, draft: !!pr.draft, state: pr.state,
    headRepository, headRepositoryPrivate,
    mergeable: pr.mergeable,
    checks: checkSummary.checks,
    status: statuses.state,
    total_checks: checkSummary.totalChecks,
    checks_complete: checkSummary.checksComplete,
    unreported_checks: checkSummary.unreportedChecks,
    checked_at: new Date().toISOString(),
  };
}
