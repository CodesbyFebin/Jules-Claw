import { inspectSkillSubmission, listSkillSources } from '../../../../lib/skill-supply-chain.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    sources: listSkillSources(),
    status: 'research_catalog_only',
    disclaimer: 'No remote skill has been cloned, installed, executed or trusted through this endpoint.'
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  // Explicit opt-in: the caller supplies already-reviewed Markdown, not an arbitrary URL.
  if (process.env.JULES_SKILL_PREFLIGHT_ENABLED !== 'true') {
    return Response.json({ error: 'Skill preflight is disabled' }, { status: 503 });
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 300000) return Response.json({ error: 'Submission too large' }, { status: 413 });
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'JSON body required' }, { status: 400 }); }
  try {
    return Response.json(inspectSkillSubmission(body), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
