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
    throw err;
  }
  return data;
}

export async function GET(_req, { params }) {
  try {
    const data = await jules(`/sessions/${params.id}`);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
