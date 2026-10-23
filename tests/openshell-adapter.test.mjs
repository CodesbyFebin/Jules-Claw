import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { buildOpenShellArgs, openShellStatus, runOpenShellProfile } from '../lib/openshell-adapter.mjs';

const env = { OPENSHELL_EXEC_ENABLED: 'true', OPENSHELL_SANDBOX_NAME: 'jules-test' };

test('OpenShell is disabled by default and accepts only a pinned sandbox name', () => {
  assert.equal(openShellStatus({}).configured, false);
  assert.throws(() => buildOpenShellArgs('syntax', {}));
  for (const name of ['BAD', '../escape', '-bad', 'bad;rm', 'a'.repeat(64)]) {
    assert.throws(() => buildOpenShellArgs('syntax', { ...env, OPENSHELL_SANDBOX_NAME: name }));
  }
  assert.throws(() => buildOpenShellArgs('arbitrary-shell', env));
});

test('OpenShell uses argument-vector fixed profile and no shell or secret forwarding', async () => {
  let invocation;
  const spawnImpl = (command, args, opts) => {
    invocation = { command, args, opts };
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(() => {
      child.stdout.emit('data', 'ok\n');
      child.emit('close', 0, null);
    });
    return child;
  };
  const result = await runOpenShellProfile('node-tests', { env, spawnImpl });
  assert.equal(invocation.command, 'openshell');
  assert.deepEqual(invocation.args, ['sandbox', 'exec', '--name', 'jules-test', '--workdir', '/workspace', '--no-tty', '--', 'node', '--test', '/workspace/tests']);
  assert.equal(invocation.opts.shell, false);
  assert.equal(invocation.opts.env.OPENSHELL_EXEC_ENABLED, undefined);
  assert.equal(result.passed, true);
  assert.equal(result.stdout, 'ok\n');
});

test('Nonzero sandbox exit is never recorded as pass', async () => {
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(() => child.emit('close', 74, null));
    return child;
  };
  const result = await runOpenShellProfile('syntax', { env, spawnImpl });
  assert.equal(result.exitCode, 74);
  assert.equal(result.passed, false);
});

test('pinned syntax execution accepts only fixed code and a full source digest', () => {
  assert.throws(() => buildOpenShellArgs('pinned-syntax', env, 'latest'), /digest/);
  const args = buildOpenShellArgs('pinned-syntax', env, 'b'.repeat(64));
  assert.deepEqual(args.slice(0, 9), ['sandbox','exec','--name','jules-test','--workdir','/workspace','--no-tty','--','node']);
  assert.equal(args[9], '-e');
  assert.match(args[10], /readFileSync\('\/workspace\/target\.mjs'\)/);
  assert.equal(args[11], 'b'.repeat(64));
});
