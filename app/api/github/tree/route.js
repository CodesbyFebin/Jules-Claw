import { permittedRepository, safeRef, flattenTree } from '../../../../lib/github-tree';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// In-process budget is a defense-in-depth guard, not a distributed rate limiter.
const budget = new Map();
export async function GET(request) {
  const p = new URL(request.url).searchParams;
  const repo = p.get('repo') || 'CodesbyFebin/Jules-Claw';
  const ref = p.get('ref') || 'main';
  if (!permittedRepository(repo) || !safeRef(ref)) return Response.json({ error: 'Repository/ref not permitted' }, { status: 400 });
  const now = Date.now();
  const entry = budget.get(repo) || { reset: now + 60000, count: 0 };
  if (now >= entry.reset) { entry.reset = now + 60000; entry.count = 0; }
  if (++entry.count > 20) return Response.json({ error: 'Local GitHub request budget exceeded' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.reset-now)/1000)) } });
  budget.set(repo, entry);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const [owner, name] = repo.split('/');
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {
      signal: controller.signal, cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Open-Jules', 'X-GitHub-Api-Version': '2022-11-28', ...(process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}) },
    });
    if (!res.ok) return Response.json({ error: 'GitHub tree request failed', upstreamStatus: res.status }, { status: res.status === 403 || res.status === 429 ? 429 : 502, headers: res.status === 403 || res.status === 429 ? { 'Retry-After': res.headers.get('retry-after') || '60' } : {} });
    const tree = flattenTree(await res.json());
    return Response.json({ repository: repo, ref, ...tree, retrievedAt: new Date().toISOString(), limit: 1000 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'GitHub unavailable' }, { status: 502 }); }
  finally { clearTimeout(timer); }
}
