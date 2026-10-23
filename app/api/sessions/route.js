import { jules, failure } from '../../../lib/jules';

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('pageToken');
    const params = new URLSearchParams({ pageSize: '30' });
    if (token) params.set('pageToken', token);
    return Response.json(await jules('/sessions?' + params));
  } catch (e) { return failure(e); }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 20000) {
      return Response.json({ error: 'A prompt of 1–20000 characters is required' }, { status: 400 });
    }
    const payload = {
      prompt: body.prompt.trim(),
      requirePlanApproval: body.requirePlanApproval !== false,
    };
    if (body.title) {
      if (typeof body.title !== 'string' || body.title.length > 200) return Response.json({ error: 'Invalid title' }, { status: 400 });
      payload.title = body.title;
    }
    if (body.automationMode === 'AUTO_CREATE_PR') payload.automationMode = body.automationMode;
    if (body.source) {
      if (typeof body.source !== 'string' || !/^sources\/[A-Za-z0-9_-]+$/.test(body.source)) return Response.json({ error: 'Invalid source' }, { status: 400 });
      if (body.branch && (typeof body.branch !== 'string' || !/^[A-Za-z0-9._/-]{1,200}$/.test(body.branch) || body.branch.includes('..'))) return Response.json({ error: 'Invalid branch' }, { status: 400 });
      payload.sourceContext = { source: body.source, githubRepoContext: { startingBranch: body.branch || 'main' } };
    }
    return Response.json(await jules('/sessions', { method: 'POST', body: JSON.stringify(payload) }));
  } catch (e) { return failure(e); }
}
