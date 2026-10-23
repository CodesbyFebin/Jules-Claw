import pg from 'pg';

let instance;

// Opt-in, loopback-only identity evaluation. The existing proxy's Basic-auth
// and host restrictions continue to protect ALL routes, including /api/auth.
export function authConfiguration(env = process.env) {
  if (env.JULES_AUTH_ENABLED !== 'true') return { enabled: false, reason: 'disabled' };
  if (env.JULES_DEPLOYMENT_MODE !== 'local-single-operator') return { enabled: false, reason: 'hosted mode not qualified' };
  if (typeof env.BETTER_AUTH_SECRET !== 'string' || env.BETTER_AUTH_SECRET.length < 32) return { enabled: false, reason: 'missing signing secret' };
  if (typeof env.DATABASE_URL !== 'string') return { enabled: false, reason: 'missing PostgreSQL URL' };
  try {
    const db = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(db.protocol)) throw new Error();
    const site = new URL(env.BETTER_AUTH_URL || 'http://127.0.0.1:3000');
    if (site.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(site.hostname)) throw new Error();
  } catch { return { enabled: false, reason: 'invalid local-only URLs' }; }
  return { enabled: true, reason: null };
}

export async function selfHostedAuth() {
  const config = authConfiguration();
  if (!config.enabled) throw Object.assign(new Error(`Identity service unavailable: ${config.reason}`), { status: 503 });
  if (!instance) {
    const { betterAuth } = await import('better-auth');
    const { nextCookies } = await import('better-auth/next-js');
    const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
    instance = betterAuth({
      database,
      baseURL: process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3000',
      secret: process.env.BETTER_AUTH_SECRET,
      emailAndPassword: { enabled: true },
      session: { cookieCache: { enabled: false } },
      plugins: [nextCookies()],
    });
  }
  return instance;
}
