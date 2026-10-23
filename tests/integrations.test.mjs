import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
async function load(name) { const src = await readFile(new URL('../lib/' + name, import.meta.url), 'utf8'); return import('data:text/javascript,' + encodeURIComponent(src)); }
const g = await load('gateway-failover.js');
const h = await load('github-tree.js');
test('gateway whitelist, bounded chat and deterministic failover chain', () => {
  const models = g.configuredModels({ GATEWAY_MODELS: 'alpha,beta,gamma,delta' });
  assert.deepEqual(g.modelChain(models,'beta'), ['beta','alpha','gamma']);
  assert.equal(g.validateChat({messages:[{role:'user',content:'hi'}],model:'beta'},models),null);
  assert.match(g.validateChat({messages:[{role:'tool',content:'x'}]},models),/Invalid/);
  assert.match(g.validateChat({messages:[{role:'user',content:'hi'}],model:'unknown'},models),/allowlist/);
  assert.equal(g.shouldFailover(429),true);
  assert.equal(g.shouldFailover(401),false);
  assert.throws(()=>g.gatewayUrl('http://example.com/v1'));
});
test('GitHub repository and ref are constrained', () => {
  assert.equal(h.permittedRepository('CodesbyFebin/Open-Jules', {}),true);
  assert.equal(h.permittedRepository('other/private', {}),false);
  assert.equal(h.safeRef('../secret'),false);
  assert.equal(h.safeRef('main'),true);
  assert.deepEqual(h.flattenTree({sha:'abc',tree:[{type:'blob',path:'a.js',sha:'c',size:12},{type:'tree',path:'dir'}]}).files,[{path:'a.js',sha:'c',size:12}]);
});
