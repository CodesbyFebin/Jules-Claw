import { jules, sessionId, failure } from '../../../../../lib/jules';

export async function GET(request, { params }) {
  try {
    const q = new URLSearchParams({ pageSize: '50' });
    const token = new URL(request.url).searchParams.get('pageToken');
    if (token) q.set('pageToken', token);
    return Response.json(await jules('/sessions/' + sessionId(params.id) + '/activities?' + q));
  } catch (e) { return failure(e); }
}
