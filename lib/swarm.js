const roles = [
  ['architect', 'Design a bounded implementation plan, state assumptions and identify file scope. Never claim code execution.'],
  ['coder', 'Propose implementation details and concise patches based on the architectural plan. Do not claim files were written.'],
  ['debugger', 'Review the proposed changes for likely runtime failures and edge cases. Do not claim tests were run.'],
  ['security', 'Review the proposed changes for vulnerabilities and permission risks. Findings are advisory.'],
  ['verifier', 'List concrete tests and properties that a real sandbox must execute. Do not invent pass results.'],
  ['manager', 'Synthesize the preceding independent reviews, identify unresolved risks and request human approval before any write.'],
];

export function validateSwarmRequest(body) {
  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 3000) return 'Prompt must be 1–3000 characters';
  if (body.confirmCost !== true) return 'Explicit confirmation of gateway usage is required';
  return null;
}

export function swarmConfiguration(env = process.env) {
  if (env.SWARM_ENABLED !== 'true') return null;
  if (!env.GATEWAY_BASE_URL || !env.GATEWAY_API_KEY) return null;
  const models = Object.fromEntries(roles.map(([role]) => [role, env['SWARM_MODEL_' + role.toUpperCase()]]));
  if (Object.values(models).some(v => !v)) return null;
  let url;
  try {
    url = new URL(env.GATEWAY_BASE_URL);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    if (url.username || url.password || url.hash || url.search) return null;
  } catch { return null; }
  return { base: url.toString().replace(/\/$/, ''), key: env.GATEWAY_API_KEY, models };
}

async function callRole(config, role, prompt, context = '') {
  const system = roles.find(([id]) => id === role)[1];
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(config.base + '/chat/completions', {
      method: 'POST', signal: controller.signal, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.key },
      body: JSON.stringify({
        model: config.models[role], temperature: 0.2, max_tokens: 1000, stream: false,
        messages: [{ role: 'system', content: system }, { role: 'user', content: 'TASK:\n' + prompt + '\n\nPRIOR OUTPUT:\n' + context.slice(0, 12000) }],
      }),
    });
    if (!response.ok) throw new Error('Gateway returned HTTP ' + response.status);
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Gateway response lacked message content');
    return {
      role, model: json.model || config.models[role], text: content.slice(0, 15000),
      latencyMs: Math.round(performance.now() - start),
      usage: json.usage || null,
    };
  } finally { clearTimeout(timer); }
}

export async function runSwarmReview(config, prompt) {
  const outputs = [];
  const architect = await callRole(config, 'architect', prompt);
  outputs.push(architect);
  const coder = await callRole(config, 'coder', prompt, architect.text);
  outputs.push(coder);
  const reviews = await Promise.all(['debugger','security','verifier'].map(role => callRole(config, role, prompt, architect.text + '\n' + coder.text)));
  outputs.push(...reviews);
  const manager = await callRole(config, 'manager', prompt, outputs.map(o => o.role + ': ' + o.text).join('\n\n'));
  outputs.push(manager);
  return {
    stages: outputs,
    actualCalls: outputs.length,
    reportedTokens: outputs.every(o => Number.isFinite(o.usage?.total_tokens))
      ? outputs.reduce((n, o) => n + o.usage.total_tokens, 0) : null,
    notice: 'Advisory LLM outputs only. No code executed, test run, security proof, or PR created by this review.',
  };
}
