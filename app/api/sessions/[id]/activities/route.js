const BASE = 'https://jules.googleapis.com/v1alpha';

function getKey() {
  const key = process.env.JULES_API_KEY;
  if (!key) throw new Error('JULES_API_KEY is not set');
  return key;
}

export async function GET(_req, { params }) {
  try {
    const res = await fetch(`${BASE}/sessions/${params.id}/activities?pageSize=50`, {
      headers: { 'x-goog-api-key': getKey() },
    });
    const data = await res.json();
    if (!res.ok) return Response.json(data, { status: res.status });
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
