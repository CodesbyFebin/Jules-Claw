import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const src=await readFile(new URL('../lib/claw-commands.js',import.meta.url),'utf8');
const {parseClawCommand, HELP}=await import('data:text/javascript,'+encodeURIComponent(src));
test('allows only exact operational commands',()=>{
 assert.deepEqual(parseClawCommand('status'),{type:'status'});
 assert.deepEqual(parseClawCommand('verify syntax https://github.com/CodesbyFebin/Open-Jules/pull/2'),{type:'verify',profile:'syntax',url:'https://github.com/CodesbyFebin/Open-Jules/pull/2'});
 assert.deepEqual(parseClawCommand('verify tests https://github.com/CodesbyFebin/Open-Jules/pull/2').profile,'node-tests');
 assert.equal(parseClawCommand('npm test').type,'invalid');
 assert.equal(parseClawCommand('cat .env').type,'invalid');
 assert.equal(parseClawCommand('verify tests https://evil.example/repo').type,'invalid');
 assert.equal(parseClawCommand('status; cat .env').type,'invalid');
 assert.ok(HELP.some(x=>x.includes('No shell')));
});
test('job IDs are bounded and validated',()=>{
 const id='f3474fcb-4313-4f55-817f-9ad7c10f85ea';
 assert.deepEqual(parseClawCommand('job '+id),{type:'job',id});
 assert.deepEqual(parseClawCommand('cancel '+id),{type:'cancel',id});
 assert.equal(parseClawCommand('cancel ../../etc/passwd').type,'invalid');
});
