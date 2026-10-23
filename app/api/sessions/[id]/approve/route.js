import { jules, sessionId, failure } from '../../../../../lib/jules';

export async function POST(_request, { params }) {
  try {
    const id = sessionId(params.id);
    const session = await jules('/sessions/' + id);
    if (session.state !== 'AWAITING_PLAN_APPROVAL') return Response.json({ error: 'Session is not awaiting plan approval' }, { status: 409 });
    await jules('/sessions/' + id + ':approvePlan', { method: 'POST', body: '{}' });
    return Response.json({ ok: true });
  } catch (e) { return failure(e); }
}
