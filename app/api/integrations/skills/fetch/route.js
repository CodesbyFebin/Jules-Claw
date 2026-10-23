import { fetchPinnedSkill } from '../../../../../lib/skill-supply-chain.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (process.env.JULES_PINNED_SKILL_FETCH_ENABLED !== 'true') {
    return Response.json({ error: 'Pinned skill fetching is disabled' }, { status: 503 });
  }
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'JSON body required' }, { status: 400 }); }
  try {
    const report = await fetchPinnedSkill(body);
    return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'Pinned source fetch or review failed', detail: error.message }, { status: 422 });
  }
}
