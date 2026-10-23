import { spawn } from 'node:child_process';

const PROFILES = Object.freeze({
  'sha256-target': ['sha256sum', '/workspace/target.mjs'],
  syntax: ['node', '--check', '/workspace/target.mjs'],
  'node-tests': ['node', '--test', '/workspace/tests'],
});

// Reads source exactly once in the sandbox, then checks its digest and parses
// those same bytes. Does not evaluate or import untrusted source.
const PINNED_SYNTAX_CHECK = `const fs=require('node:fs');const crypto=require('node:crypto');const cp=require('node:child_process');
const expected=process.argv[1];if(!/^[a-f0-9]{64}$/.test(expected))process.exit(64);
const source=fs.readFileSync('/workspace/target.mjs');if(source.length>1024*1024)process.exit(65);
const actual=crypto.createHash('sha256').update(source).digest('hex');
if(actual!==expected){console.error('source mismatch');process.exit(66)}
const checked=cp.spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8',timeout:15000,maxBuffer:64*1024});
if(checked.status!==0||checked.error){console.error('syntax check failed');process.exit(67)}
console.log('JULES_PINNED_SYNTAX_OK '+actual);`;

export function openShellStatus(env = process.env) {
  return {
    enabled: env.OPENSHELL_EXEC_ENABLED === 'true',
    configured: env.OPENSHELL_EXEC_ENABLED === 'true' && !!env.OPENSHELL_SANDBOX_NAME,
    mode: 'existing_sandbox_fixed_profiles',
    verified: false,
  };
}

export function buildOpenShellArgs(profile, env = process.env, sourceSha256) {
  if (env.OPENSHELL_EXEC_ENABLED !== 'true') throw new Error('OpenShell execution is disabled');
  if (profile !== 'pinned-syntax' && !Object.hasOwn(PROFILES, profile)) throw new Error('Unsupported verification profile');
  if (profile === 'pinned-syntax' && (typeof sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sourceSha256))) throw new Error('Pinned source digest required');
  const name = env.OPENSHELL_SANDBOX_NAME;
  if (typeof name !== 'string' || name.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) {
    throw new Error('A valid pre-provisioned OpenShell sandbox is required');
  }
  const command = profile === 'pinned-syntax' ? ['node', '-e', PINNED_SYNTAX_CHECK, sourceSha256] : PROFILES[profile];
  return ['sandbox', 'exec', '--name', name, '--workdir', '/workspace', '--no-tty', '--', ...command];
}

export async function runOpenShellProfile(profile, options = {}) {
  const { env = process.env, spawnImpl = spawn, timeoutMs = 90000, maxBytes = 128 * 1024, sourceSha256 } = options;
  const args = buildOpenShellArgs(profile, env, sourceSha256);
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
