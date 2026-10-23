import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export function nvidiaCapabilities(env = process.env) {
  return {
    openShell: { configured: env.NVIDIA_OPENSHELL_ENABLED === 'true', status: env.NVIDIA_OPENSHELL_ENABLED === 'true' ? 'configured_not_verified' : 'disabled' },
    skillSpector: { configured: env.NVIDIA_SKILL_SCAN_ENABLED === 'true' && !!env.NVIDIA_SKILL_ROOT, status: env.NVIDIA_SKILL_SCAN_ENABLED === 'true' && !!env.NVIDIA_SKILL_ROOT ? 'configured_not_verified' : 'disabled', mode: 'static_only' },
    nemoAgentToolkit: { configured: false, status: 'not_integrated' },
    nemoClaw: { configured: false, status: 'not_integrated' },
    note: 'Configuration is not proof of an installed binary, running sandbox, completed scan, or model invocation.'
  };
}

export function validateSkillName(value) {
  if (typeof value !== 'string' || value.length > 96 || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(value) || value === '.' || value === '..') {
    throw new Error('A single skill directory name is required');
  }
  return value;
}

export async function resolveSkillDirectory(root, name, resolvePath = realpath) {
  validateSkillName(name);
  if (!root || !isAbsolute(root)) throw new Error('NVIDIA_SKILL_ROOT must be an absolute path');
  const realRoot = await resolvePath(root);
  const candidate = await resolvePath(resolve(realRoot, name));
  const offset = relative(realRoot, candidate);
  if (!offset || offset.startsWith('..') || isAbsolute(offset)) throw new Error('Skill path escapes the configured root');
  return candidate;
}

export function runBounded(command, args, { timeoutMs = 45000, maxBytes = 131072, spawnImpl = spawn } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error('Invalid timeout');
  return new Promise((resolveResult, reject) => {
    const child = spawnImpl(command, args, {
      shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: process.env.HOME || '/tmp' }
    });
    let stdout = '', stderr = '', capped = false, timedOut = false, settled = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    const capture = (text, stream) => {
      const next = text + String(stream);
      if (Buffer.byteLength(next) > maxBytes) {
        capped = true;
        child.kill('SIGKILL');
        return next.slice(0, maxBytes);
      }
      return next;
    };
    child.stdout?.on('data', d => { stdout = capture(stdout, d); });
    child.stderr?.on('data', d => { stderr = capture(stderr, d); });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolveResult(result);
    };
    child.on('error', error => finish(error));
    child.on('close', (code, signal) => finish(null, { exitCode: code, signal, stdout, stderr, timedOut, capped }));
  });
}

export function parseSkillSpectorReport(result) {
  if (result.timedOut || result.capped) throw new Error('Scan incomplete: time or output limit exceeded');
  let json;
  try { json = JSON.parse(result.stdout); }
  catch { throw new Error('SkillSpector did not return valid JSON'); }
  if (!json || typeof json !== 'object') throw new Error('Invalid SkillSpector report');
  const risk = json.risk_score ?? json.overall_risk_score ?? null;
  const score = typeof risk === 'number' && Number.isFinite(risk) && risk >= 0 && risk <= 100 ? risk : null;
  const findings = Array.isArray(json.filtered_findings) ? json.filtered_findings : (Array.isArray(json.findings) ? json.findings : null);
  // Do not infer safety when the report schema is unknown or a nonzero exit code is returned.
  return {
    provider: 'NVIDIA SkillSpector',
    mode: 'static_only',
    completed: result.exitCode === 0 && score !== null && findings !== null,
    safeToInstall: false,
    riskScore: score,
    findings: findings ? findings.slice(0, 100) : [],
    findingCount: findings?.length ?? null,
    exitCode: result.exitCode,
    note: 'A scanner result is advisory, never sandbox proof. Installation still requires explicit human approval.'
  };
}

export async function scanLocalSkill(name, env = process.env, deps = {}) {
  if (env.NVIDIA_SKILL_SCAN_ENABLED !== 'true') throw new Error('Skill scanning is disabled');
  const path = await resolveSkillDirectory(env.NVIDIA_SKILL_ROOT, name, deps.realpath || realpath);
  const command = env.SKILLSPECTOR_BINARY || 'skillspector';
  const result = await (deps.run || runBounded)(command, ['scan', path, '--no-llm', '--format', 'json']);
  return { skill: name, ...parseSkillSpectorReport(result) };
}
