import { configuredModels, validateChat, modelChain, shouldFailover, gatewayUrl, localModelConfig } from '../../../../lib/gateway-failover';
import { capabilityState, hostSnapshot, CAPABILITY } from '../../../../lib/capability-state.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  let url, local;
  try {
    url = process.env.GATEWAY_BASE_URL && process.env.GATEWAY_API_KEY ? gatewayUrl(process.env.GATEWAY_BASE_URL) : null;
    local = localModelConfig();
  } catch { return Response.json({ error: 'Invalid gateway configuration' }, { status: 503 }); }
  const models = configuredModels();
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const problem = validateChat(body, [...models, ...(local ? [local.model] : [])]);
  if (problem) return Response.json({ error: problem }, { status: models.length || local ? 400 : 503 });
  const remoteConfigured = Boolean(url && models.length);
  const resource = capabilityState({ ...hostSnapshot(), localAvailable: Boolean(local), remoteAvailable: remoteConfigured });
  if (resource.level === CAPABILITY.HALT || resource.level === CAPABILITY.READ_ONLY)
    return Response.json({ error: 'Inference paused', capability: resource }, { status: 503 });
  const attempts = [];
  const targets = [
    ...(remoteConfigured ? modelChain(models, models.includes(body.model) ? body.model : undefined).map(model => ({ model, url, key: process.env.GATEWAY_API_KEY, provider: 'remote' })) : []),
    ...(local ? [{ ...local, provider: 'local' }] : []),
  ];
  for (const target of targets) {
    const { model } = target;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const start = performance.now();
    try {
      const res = await fetch(target.url, {
        method: 'POST', signal: controller.signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...(target.key ? { Authorization: 'Bearer ' + target.key } : {}) },
        body: JSON.stringify({ model, messages: body.messages, max_tokens: 1200, stream: false }),
      });
      attempts.push({ model, provider: target.provider, status: res.status, latencyMs: Math.round(performance.now() - start) });
      if (res.ok) {
        const data = await res.json();
        if (!Array.isArray(data.choices)) return Response.json({ error: 'Malformed gateway response', attempts }, { status: 502 });
        return Response.json({ ...data, _openJules: { modelUsed: model, capability: target.provider === 'local' ? CAPABILITY.LOCAL : resource.level, attempts } }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (!shouldFailover(res.status)) return Response.json({ error: 'Gateway rejected request', attempts }, { status: res.status });
    } catch (e) {
      attempts.push({ model, provider: target.provider, status: e.name === 'AbortError' ? 'timeout' : 'network_error', latencyMs: Math.round(performance.now() - start) });
    } finally { clearTimeout(timer); }
  }
  return Response.json({ error: 'All configured gateway routes failed', attempts }, { status: 502 });
}
