export function parseGitHubPullRequestUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw Object.assign(new Error('Invalid pull request URL'), { status: 400 }); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('Only GitHub pull request URLs are accepted'), { status: 400 });
  }
  const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)\/?$/);
  if (!match) throw Object.assign(new Error('Invalid GitHub pull request path'), { status: 400 });
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
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
  return {
    url: pr.html_url, sha, draft: !!pr.draft, state: pr.state,
    mergeable: pr.mergeable,
    checks: (checks.check_runs || []).map(c => ({
      id: c.id, name: c.name, status: c.status, conclusion: c.conclusion,
      url: c.html_url, started_at: c.started_at, completed_at: c.completed_at,
    })),
    status: statuses.state,
    total_checks: checks.total_count || 0,
    checked_at: new Date().toISOString(),
  };
}
