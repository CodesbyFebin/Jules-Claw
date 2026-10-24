import { NextResponse } from 'next/server';
import { localAccessPermitted } from './lib/access-mode.mjs';

function equalSecrets(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  const count = Math.max(left.length, right.length);
  for (let i = 0; i < count; i++) difference |= (left[i] || 0) ^ (right[i] || 0);
  return difference === 0;
}

export function proxy(request) {
  if (!localAccessPermitted(process.env, request.nextUrl.hostname)) {
    return new NextResponse('Open Web LLM is local-only until multi-user authentication is installed', { status: 503 });
  }
  const configured = process.env.OPEN_JULES_PASSWORD;
  if (!configured || configured.length < 16) {
    return new NextResponse('Open Web LLM is locked: configure OPEN_JULES_PASSWORD (16+ characters)', { status: 503 });
  }
  const header = request.headers.get('authorization') || '';
  let valid = false;
  if (header.startsWith('Basic ')) {
    try {
      const value = atob(header.slice(6));
      const split = value.indexOf(':');
      valid = split >= 0 && equalSecrets(value.slice(0, split), process.env.OPEN_JULES_USERNAME || 'admin') && equalSecrets(value.slice(split + 1), configured);
    } catch { valid = false; }
  }
  if (!valid) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Open Web LLM", charset="UTF-8"', 'Cache-Control': 'no-store' },
    });
  }
  // Provider integrations and shared worker routes are not yet proven safe
  // for concurrent tenant sessions. Disable them in identity staging rather
  // than treating a signed-in user as authorized to access global resources.
  if (process.env.JULES_AUTH_ENABLED === 'true' && request.nextUrl.pathname.startsWith('/api/')) {
    const path = request.nextUrl.pathname;
    const approved = path.startsWith('/api/auth/') || path === '/api/desk' ||
      path === '/api/memory' || path === '/api/verification' ||
      /^\/api\/verification\/[0-9a-f-]{36}$/.test(path);
    if (!approved) return NextResponse.json({ error: 'Integration unavailable until tenant qualification' }, { status: 503 });
  }
  if (request.nextUrl.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    // The browser-facing Host can differ from Next.js's normalized nextUrl.origin.
    // Compare against the actual loopback authority while retaining strict Origin denial.
    const host = request.headers.get('host') || '';
    const loopbackHost = /^(?:127\\.0\\.0\\.1|localhost|\\[::1\\])(?::[0-9]{1,5})?$/.test(host);
    const expectedOrigin = loopbackHost ? new URL(request.nextUrl.protocol + '//' + host).origin : '';
    if (origin && (!expectedOrigin || origin !== expectedOrigin)) {
      if (process.env.QUALIFICATION_DISPOSABLE === 'I_CONFIRM_DISPOSABLE') console.warn('CI origin mismatch', JSON.stringify({ origin, host, expectedOrigin, nextOrigin: request.nextUrl.origin }));
      return NextResponse.json({ error: 'Cross-origin mutations are forbidden' }, { status: 403 });
    }
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
