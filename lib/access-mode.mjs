/** Only single-user loopback operation is supported until an identity provider is integrated. */
export function localAccessPermitted(env, hostname) {
  if (env.VERCEL === '1' || env.VERCEL === 'true') return false;
  if ((env.JULES_DEPLOYMENT_MODE || 'local-single-operator') !== 'local-single-operator') return false;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}
