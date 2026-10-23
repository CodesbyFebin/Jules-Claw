import { toNextJsHandler } from 'better-auth/next-js';
import { selfHostedAuth } from '../../../../lib/self-hosted-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request) {
  try {
    const auth = await selfHostedAuth();
    const { GET, POST } = toNextJsHandler(auth);
    return request.method === 'GET' ? GET(request) : POST(request);
  } catch {
    return Response.json({ error: 'Identity service unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const GET = handle;
export const POST = handle;
