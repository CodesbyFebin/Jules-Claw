// Deterministic verification benchmark for the trusted Open Web LLM source tree.
// This does NOT score an LLM or claim to run arbitrary generated code safely.
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profiles = Object.freeze([
  { id: 'agent-validation', args: ['--test', 'tests/jules.test.mjs', 'tests/swarm.test.mjs'] },
  { id: 'security-preflight', args: ['--test', 'tests/nvidia-integration.test.mjs', 'tests/skill-supply-chain.test.mjs', 'tests/openshell-adapter.test.mjs'] },
  { id: 'evidence-logic', args: ['--test', 'tests/verification.test.mjs', 'tests/github-evidence.test.mjs', 'tests/quotas.test.mjs'] },
  { id: 'concurrent-quota', args: ['--test', 'tests/quotas-concurrency.test.mjs'] },
  { id: 'approval-security', args: ['--test', 'tests/capability-approvals.test.mjs', 'tests/approved-execution.test.mjs', 'tests/access-mode.test.mjs'] },
]);

async function runTask(task, timeoutMs = 30000) {
  return await new Promise((finish) => {
    const started = performance.now();
    const child = spawn(process.execPath, task.args, {
      cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH || '/usr/bin:/bin', NODE_OPTIONS: '' },
    });
    let stdout = '', stderr = '', timedOut = false;
    const capture = (old, chunk) => (old + String(chunk)).slice(-16384);
    child.stdout.on('data', data => { stdout = capture(stdout, data); });
    child.stderr.on('data', data => { stderr = capture(stderr, data); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    let done = false;
    const complete = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      finish({
        task: task.id, command: [process.execPath, ...task.args],
        durationMs: Math.round(performance.now() - started),
        timedOut, ...result,
      });
    };
    child.on('error', err => complete({ exitCode: null, passed: false, stdout, stderr: capture(stderr, err.message) }));
    child.on('close', exitCode => complete({ exitCode, passed: exitCode === 0 && !timedOut, stdout, stderr }));
  });
}

export async function runBenchmark() {
  const results = [];
  for (const task of profiles) results.push(await runTask(task));
  const manifest = await readFile(resolve(root, 'package-lock.json'));
  return {
    schema: 'open-web-llm-benchmark.v1',
    mode: 'measured_trusted_test_suite',
    runtime: process.version,
    platform: process.platform,
    lockfileSha256: createHash('sha256').update(manifest).digest('hex'),
    taskManifestSha256: createHash('sha256').update(JSON.stringify(profiles)).digest('hex'),
    results,
    passed: results.every(result => result.passed),
    warning: 'Measures real local test subprocesses only. Does not measure model coding quality, agent autonomy, security proof, or third-party provider speed.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runBenchmark();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}
