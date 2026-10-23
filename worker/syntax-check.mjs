import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = '/work';
const files = [];
async function walk(dir, depth = 0) {
  if (depth > 12 || files.length > 3000) throw new Error('Repository scan limit exceeded');
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules','.git','.next','dist','build'].includes(ent.name)) continue;
    const path = join(dir, ent.name);
    if (ent.isDirectory()) await walk(path, depth + 1);
    else if (ent.isFile() && /\.(js|mjs|cjs)$/.test(ent.name)) files.push(path);
  }
}
function check(file) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['--check', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr = (stderr + d).slice(-4096); });
    proc.on('error', e => resolve({ ok: false, detail: e.message }));
    proc.on('close', code => resolve({ ok: code === 0, detail: stderr }));
  });
}
try {
  await walk(root);
  if (!files.length) throw new Error('No supported JavaScript files found; cannot record a pass');
  let failed = 0;
  for (const file of files) {
    const result = await check(file);
    if (!result.ok) { failed++; process.stderr.write(file + ': ' + result.detail + '\n'); }
  }
  process.stdout.write(JSON.stringify({ checked: files.length, failed }) + '\n');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  process.stderr.write(e.message + '\n');
  process.exitCode = 2;
}
