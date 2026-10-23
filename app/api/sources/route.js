import { jules, failure } from '../../../lib/jules';

export async function GET() {
  try { return Response.json(await jules('/sources')); }
  catch (e) { return failure(e); }
}
