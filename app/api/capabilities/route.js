import { openApprovalDb, requestApproval, approvalStatus } from '../../../lib/capability-approvals.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withDb(action) {
  let db;
  try { db = openApprovalDb(); return action(db); }
  catch { return Response.json({ error: 'Approval store unavailable' }, { status: 503 }); }
  finally { db?.close(); }
}
export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: 'Valid approval ID required' }, { status: 400 });
  return withDb(db => {
    const record = approvalStatus(db, id);
    return record ? Response.json({ approval: record }) : Response.json({ error: 'Not found' }, { status: 404 });
  });
}
export async function POST(request) {
  let action;
  try { action = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  // Never provide remote approval/consume endpoints. They require local TTY and trusted executor.
  if (!action || typeof action !== 'object') return Response.json({ error: 'Invalid action' }, { status: 400 });
  return withDb(db => {
    try { return Response.json({ approval: requestApproval(db, action) }, { status: 202 }); }
    catch (error) { if (error.message.startsWith('Invalid') || error.message.includes('required') || error.message.includes('allowlisted') || error.message.includes('Unexpected')) return Response.json({ error: error.message }, { status: 400 }); throw error; }
  });
}
