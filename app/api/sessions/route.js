const BASE = 'https://jules.googleapis.com/v1alpha';

function getKey() {
  const key = process.env.JULES_API_KEY;
  if (!key) throw new Error('JULES_API_KEY is not set');
  return key;
}

async function jules(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'x-goog-api-key': getKey(),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data.error?.message || `Jules API error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function GET() {
  try {
    const data = await jules('/sessions?pageSize=30');
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const payload = {
      prompt: body.prompt,
      title: body.title || undefined,
      requirePlanApproval: body.requirePlanApproval !== false,
      automationMode: body.automationMode || undefined,
    };
    if (body.source) {
      payload.sourceContext = {
        source: body.source,
        githubRepoContext: { startingBranch: body.branch || 'main' },
      };
    }
    const data = await jules('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
