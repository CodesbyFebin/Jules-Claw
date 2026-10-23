const BASE = 'https://jules.googleapis.com/v1alpha';

export function sessionId(value) {
  const id = String(value || '').replace(/^sessions\//, '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw Object.assign(new Error('Invalid session resource'), { status: 400 });
  return id;
}

export async function jules(path, options = {}) {
  const key = process.env.JULES_API_KEY;
  if (!key) throw Object.assign(new Error('JULES_API_KEY is not set'), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(BASE + path, {
      ...options, cache: 'no-store', signal: controller.signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const raw = await res.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    if (!res.ok) throw Object.assign(new Error(data.error?.message || 'Jules request failed'), { status: res.status });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Jules request timed out'), { status: 504 });
    throw error;
  } finally { clearTimeout(timer); }
}

export function failure(error) {
  return Response.json({ error: error.message || 'Unexpected error' }, { status: error.status || 502 });
}
