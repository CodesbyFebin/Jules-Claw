import { validateSwarmRequest, swarmConfiguration, runSwarmReview } from '../../../lib/swarm';
export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const problem = validateSwarmRequest(body);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    const config = swarmConfiguration();
    if (!config) return Response.json({ error: 'Six-role gateway review is disabled or not fully configured' }, { status: 501 });
    const result = await runSwarmReview(config, body.prompt.trim());
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e.name === 'AbortError' ? 'Gateway timed out' : 'Gateway review failed: ' + e.message }, { status: 502 });
  }
}
