import { nvidiaCapabilities, scanLocalSkill, validateSkillName } from '../../../../lib/nvidia-integration.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(nvidiaCapabilities(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON body required' }, { status: 400 }); }
  try {
    validateSkillName(body?.skill);
    if (process.env.NVIDIA_SKILL_SCAN_ENABLED !== 'true') return Response.json({ error: 'Skill scanning is disabled' }, { status: 503 });
    const result = await scanLocalSkill(body.skill);
    return Response.json(result, { status: result.completed ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const invalid = /skill directory name|required|escapes/.test(error.message);
    return Response.json({ error: invalid ? error.message : 'Skill scanning unavailable or incomplete' }, { status: invalid ? 400 : 503 });
  }
}
