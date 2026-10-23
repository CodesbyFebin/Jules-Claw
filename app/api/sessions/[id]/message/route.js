import { jules, sessionId, failure } from '../../../../../lib/jules';

export async function POST(request, { params }) {
  try {
    const id = sessionId(params.id);
    const body = await request.json();
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 20000) return Response.json({ error: 'A message of 1–20000 characters is required' }, { status: 400 });
    await jules('/sessions/' + id + ':sendMessage', { method: 'POST', body: JSON.stringify({ prompt: body.prompt.trim() }) });
    return Response.json({ ok: true });
  } catch (e) { return failure(e); }
}
