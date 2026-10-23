import { NextResponse } from 'next/server';

function equalSecrets(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  const count = Math.max(left.length, right.length);
  for (let i = 0; i < count; i++) difference |= (left[i] || 0) ^ (right[i] || 0);
  return difference === 0;
}

export function middleware(request) {
  const configured = process.env.OPEN_JULES_PASSWORD;
  if (!configured || configured.length < 16) {
    return new NextResponse('Jules Claw is locked: configure OPEN_JULES_PASSWORD (16+ characters)', { status: 503 });
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
      headers: { 'WWW-Authenticate': 'Basic realm="Jules Claw", charset="UTF-8"', 'Cache-Control': 'no-store' },
    });
  }
  if (request.nextUrl.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Cross-origin mutations are forbidden' }, { status: 403 });
    }
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
