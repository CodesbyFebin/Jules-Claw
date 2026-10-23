const pattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export function permittedRepository(repo, env = process.env) {
  if (typeof repo !== 'string' || !pattern.test(repo)) return false;
  const allowed = (env.GITHUB_ALLOWED_REPOS || 'CodesbyFebin/Jules-Claw').split(',').map(s => s.trim());
  return allowed.includes(repo);
}
export function safeRef(ref) {
  return typeof ref === 'string' && ref.length < 100 && /^[A-Za-z0-9_./-]+$/.test(ref) && !ref.includes('..') && !ref.startsWith('/') && !ref.endsWith('/') && !ref.includes('//');
}
export function flattenTree(payload) {
  return {
    sha: payload.sha,
    truncated: !!payload.truncated,
    files: (payload.tree || []).filter(item => item.type === 'blob').slice(0, 1000).map(item => ({ path: item.path, sha: item.sha, size: item.size })),
  };
}
