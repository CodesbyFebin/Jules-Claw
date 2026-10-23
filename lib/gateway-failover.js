export function configuredModels(env = process.env) {
  return (env.GATEWAY_MODELS || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
}
export function validateChat(body, models) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) return '1–40 messages required';
  if (!models.length) return 'No permitted models configured';
  if (body.model !== undefined && !models.includes(body.model)) return 'Model not in gateway allowlist';
  if (body.messages.some(m => !m || !['user','system','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 12000)) return 'Invalid message';
  if (JSON.stringify(body).length > 60000) return 'Request too large';
  return null;
}
export function modelChain(models, chosen) {
  const preferred = chosen || models[0];
  return [preferred, ...models.filter(m => m !== preferred)].slice(0, 3);
}
export function shouldFailover(status) {
  return [408,429,500,502,503,504].includes(status);
}
export function gatewayUrl(base) {
  const url = new URL(base);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw Error('Gateway must use HTTPS');
  if (url.username || url.password || url.search || url.hash) throw Error('Invalid gateway URL');
  return url.toString().replace(/\/$/, '') + '/chat/completions';
}
export function localModelConfig(env = process.env) {
  if (!env.JULES_LOCAL_LLM_URL || !env.JULES_LOCAL_LLM_MODEL) return null;
  const address = new URL(env.JULES_LOCAL_LLM_URL);
  if (address.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname) || address.username || address.password || address.search || address.hash)
    throw new Error('Local LLM must be an unauthenticated loopback HTTP endpoint');
  return { url: gatewayUrl(address.toString()), model: env.JULES_LOCAL_LLM_MODEL };
}
