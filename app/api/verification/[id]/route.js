import { getPool } from '../../../../lib/desk';
import { validateJobId } from '../../../../lib/verification';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  if (!validateJobId(params.id)) return Response.json({ error: 'Invalid job id' }, { status: 400 });
  try {
    const r = await getPool().query('SELECT * FROM verification_jobs WHERE id = $1', [params.id]);
    if (!r.rowCount) return Response.json({ error: 'Job not found' }, { status: 404 });
    return Response.json({ job: r.rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: 'Verification storage unavailable' }, { status: 503 }); }
}

export async function DELETE(_request, { params }) {
  if (!validateJobId(params.id)) return Response.json({ error: 'Invalid job id' }, { status: 400 });
  try {
    const r = await getPool().query(
      `UPDATE verification_jobs SET
         cancel_requested = true,
         status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
         finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END
       WHERE id = $1 AND status IN ('queued','running')
       RETURNING id, status, cancel_requested`,
      [params.id]
    );
    if (!r.rowCount) return Response.json({ error: 'Job is not cancellable' }, { status: 409 });
    return Response.json({ job: r.rows[0] });
  } catch (e) { return Response.json({ error: 'Verification storage unavailable' }, { status: 503 }); }
}
