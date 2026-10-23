export async function POST(request) {
  const base = process.env.GATEWAY_BASE_URL;
  const key = process.env.GATEWAY_API_KEY;
  if (!base || !key) return Response.json({ error: 'Gateway is not configured' }, { status: 501 });
  let url;
  try {
    url = new URL(base);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('HTTPS required');
    if (url.username || url.password || url.search || url.hash) throw new Error('Invalid gateway URL');
  } catch {
    return Response.json({ error: 'Invalid gateway configuration' }, { status: 503 });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || typeof body.model !== 'string' || !Array.isArray(body.messages)) return Response.json({ error: 'model and messages required' }, { status: 400 });
    if (JSON.stringify(body).length > 100000) return Response.json({ error: 'Request too large' }, { status: 413 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url.toString().replace(/\/$/, '') + '/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ ...body, stream: false }),
      });
      const data = await response.json();
      return Response.json(data, { status: response.status });
    } finally { clearTimeout(timer); }
  } catch (e) {
    return Response.json({ error: e.name === 'AbortError' ? 'Gateway timeout' : 'Gateway request failed' }, { status: 502 });
  }
}
