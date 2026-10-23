export const PROFILES = Object.freeze(['syntax', 'node-tests']);

export function validateVerificationJob(body) {
  if (!body || typeof body !== 'object') return 'Invalid request body';
  if (typeof body.pullRequestUrl !== 'string' || body.pullRequestUrl.length > 2048) return 'Valid PR URL required';
  if (!PROFILES.includes(body.profile)) return 'Unsupported verification profile';
  return null;
}

export function validateJobId(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
