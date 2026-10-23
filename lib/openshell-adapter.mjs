import { spawn } from 'node:child_process';

const PROFILES = Object.freeze({
  syntax: ['node', '--check', '/workspace/target.mjs'],
  'node-tests': ['node', '--test', '/workspace/tests'],
});

export function openShellStatus(env = process.env) {
  return {
    enabled: env.OPENSHELL_EXEC_ENABLED === 'true',
    configured: env.OPENSHELL_EXEC_ENABLED === 'true' && !!env.OPENSHELL_SANDBOX_NAME,
    mode: 'existing_sandbox_fixed_profiles',
    verified: false,
  };
}

export function buildOpenShellArgs(profile, env = process.env) {
  if (env.OPENSHELL_EXEC_ENABLED !== 'true') throw new Error('OpenShell execution is disabled');
  if (!Object.hasOwn(PROFILES, profile)) throw new Error('Unsupported verification profile');
  const name = env.OPENSHELL_SANDBOX_NAME;
  if (typeof name !== 'string' || name.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) {
    throw new Error('A valid pre-provisioned OpenShell sandbox is required');
  }
  return ['sandbox', 'exec', '--name', name, '--workdir', '/workspace', '--no-tty', '--', ...PROFILES[profile]];
}

export async function runOpenShellProfile(profile, options = {}) {
  const { env = process.env, spawnImpl = spawn, timeoutMs = 90000, maxBytes = 128 * 1024 } = options;
  const args = buildOpenShellArgs(profile, env);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error('Invalid timeout');
  if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 1024 * 1024) throw new Error('Invalid output limit');
  // Intentional: runs in an existing, externally policy-controlled sandbox.
  // This adapter does not provision, upload, mutate policies, or inject secrets.
  return new Promise((resolve, reject) => {
    const child = spawnImpl('openshell', args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: env.PATH || '/usr/bin:/bin', HOME: env.HOME || '/tmp' },
    });
    let stdout = '', stderr = '', timedOut = false, truncated = false, complete = false;
    const capture = (previous, chunk) => {
      const value = previous + String(chunk);
      if (Buffer.byteLength(value) > maxBytes) {
        truncated = true;
        child.kill('SIGKILL');
        return value.slice(0, maxBytes);
      }
      return value;
    };
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    const finish = (error, result) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };
    child.stdout?.on('data', chunk => { stdout = capture(stdout, chunk); });
    child.stderr?.on('data', chunk => { stderr = capture(stderr, chunk); });
    child.on('error', error => finish(error));
    child.on('close', (exitCode, signal) => finish(null, {
      profile, sandbox: env.OPENSHELL_SANDBOX_NAME,
      exitCode, signal, stdout, stderr, timedOut, truncated,
      passed: exitCode === 0 && !timedOut && !truncated,
      source: 'openshell_cli_real_process', note: 'CLI exit status is evidence of invocation, not sandbox-policy attestation.',
    }));
  });
}
