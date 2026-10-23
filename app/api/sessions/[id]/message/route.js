const BASE = 'https://jules.googleapis.com/v1alpha';

function getKey() {
  const key = process.env.JULES_API_KEY;
  if (!key) throw new Error('JULES_API_KEY is not set');
  return key;
}

export async function POST(req, { params }) {
  try {
    const body = await req.json();
    const res = await fetch(`${BASE}/sessions/${params.id}:sendMessage`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': getKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: body.prompt }),
    });
    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: text }, { status: res.status });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
