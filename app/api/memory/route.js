import { openMemory, recall, remember, forget, validateMemory } from '../../../lib/local-memory.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withDb(action) {
  let db;
  try { db = openMemory(); return action(db); }
  catch { return Response.json({ error: 'Local memory unavailable' }, { status: 503 }); }
  finally { db?.close(); }
}

export async function GET(request) {
  const query = new URL(request.url).searchParams.get('q') || '';
  if (query.length > 200) return Response.json({ error: 'Query too long' }, { status: 400 });
  return withDb(db => Response.json({ records: recall(db, query) }, { headers: { 'Cache-Control': 'no-store' } }));
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (body?.action === 'forget') {
    if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id) || body.confirm !== true)
      return Response.json({ error: 'Explicit deletion confirmation and ID required' }, { status: 400 });
    return withDb(db => Response.json({ deleted: forget(db, body.id) }));
  }
  return withDb(db => {
    const issue = validateMemory(body);
    if (issue) return Response.json({ error: issue }, { status: 400 });
    return Response.json({ record: remember(db, body) }, { status: 201 });
  });
}
