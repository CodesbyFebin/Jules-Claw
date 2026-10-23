import { pullRequestEvidence } from '../../../../lib/github-evidence';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url || url.length > 2048) return Response.json({ error: 'GitHub PR URL is required' }, { status: 400 });
  try { return Response.json(await pullRequestEvidence(url), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return Response.json({ error: e.message }, { status: e.status || 502 }); }
}
