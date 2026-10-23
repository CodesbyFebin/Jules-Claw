import { configuredModels, validateChat, modelChain, shouldFailover, gatewayUrl } from '../../../../lib/gateway-failover';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  if (!process.env.GATEWAY_BASE_URL || !process.env.GATEWAY_API_KEY) return Response.json({ error: 'Gateway not configured' }, { status: 503 });
  let url;
  try { url = gatewayUrl(process.env.GATEWAY_BASE_URL); } catch { return Response.json({ error: 'Invalid gateway URL' }, { status: 503 }); }
  const models = configuredModels();
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const problem = validateChat(body, models);
  if (problem) return Response.json({ error: problem }, { status: models.length ? 400 : 503 });
  const attempts = [];
  for (const model of modelChain(models, body.model)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: 'POST', signal: controller.signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GATEWAY_API_KEY },
        body: JSON.stringify({ model, messages: body.messages, max_tokens: 1200, stream: false }),
      });
      attempts.push({ model, status: res.status, latencyMs: Math.round(performance.now() - start) });
      if (res.ok) {
        const data = await res.json();
        if (!Array.isArray(data.choices)) return Response.json({ error: 'Malformed gateway response', attempts }, { status: 502 });
        return Response.json({ ...data, _openJules: { modelUsed: model, attempts } }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (!shouldFailover(res.status)) return Response.json({ error: 'Gateway rejected request', attempts }, { status: res.status });
    } catch (e) {
      attempts.push({ model, status: e.name === 'AbortError' ? 'timeout' : 'network_error', latencyMs: Math.round(performance.now() - start) });
    } finally { clearTimeout(timer); }
  }
  return Response.json({ error: 'All configured gateway routes failed', attempts }, { status: 502 });
}
