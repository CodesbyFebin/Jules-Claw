import { jules, sessionId, failure } from '../../../../lib/jules';

export async function GET(_request, { params }) {
  try { return Response.json(await jules('/sessions/' + sessionId(params.id))); }
  catch (e) { return failure(e); }
}
