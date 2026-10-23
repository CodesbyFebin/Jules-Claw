// Simple in-memory memory layer stub.
// Replace with Mem0, OpenMemory MCP, or Graphiti for production.
// Inspired by Open-Source-Ai-Full-Stack memory category.

const store = new Map();

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user') || 'default';
  const q = searchParams.get('q') || '';
  const items = store.get(user) || [];
  const filtered = q ? items.filter(i => i.text.toLowerCase().includes(q.toLowerCase())) : items;
  return Response.json({ user, memories: filtered });
}

export async function POST(req) {
  const body = await req.json();
  const user = body.user || 'default';
  const text = body.text || body.memory || '';
  if (!text) return Response.json({ error: 'text required' }, { status: 400 });
  const items = store.get(user) || [];
  const entry = { id: Date.now().toString(), text, ts: new Date().toISOString() };
  items.push(entry);
  store.set(user, items);
  return Response.json({ ok: true, entry });
}
