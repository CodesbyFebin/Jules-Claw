import { getPool, validateDesk } from '../../../lib/desk';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getPool().query('SELECT id, title, detail, status, created_at FROM desk_entries ORDER BY created_at DESC LIMIT 50');
    return Response.json({ items: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : 'Desk storage unavailable' }, { status: e.status || 503 }); }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const problem = validateDesk(body);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    const result = await getPool().query(
      'INSERT INTO desk_entries (title, detail, status) VALUES ($1, $2, $3) RETURNING id, title, detail, status, created_at',
      [body.title.trim(), body.detail.trim(), body.status],
    );
    return Response.json({ item: result.rows[0] }, { status: 201 });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : 'Unable to save desk entry' }, { status: e.status || 503 }); }
}
