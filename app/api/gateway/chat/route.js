// OpenAI-compatible gateway stub.
// Wire this to LiteLLM, Bifrost, Portkey, or FreeLLMAPI from the Open Source AI Stack.
// Example: set GATEWAY_BASE_URL=http://localhost:4000/v1

export async function POST(req) {
  const body = await req.json();
  const base = process.env.GATEWAY_BASE_URL;
  if (!base) {
    return Response.json({
      error: 'GATEWAY_BASE_URL not set. Point to LiteLLM / Bifrost / Portkey (see Open-Source-Ai-Full-Stack gateways).',
      received: body,
    }, { status: 501 });
  }
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GATEWAY_API_KEY || 'sk-local'}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
