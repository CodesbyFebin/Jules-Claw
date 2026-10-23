import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
const files = [];
async function walk(dir, depth = 0) {
  if (depth > 10 || files.length > 1000) throw new Error('Test discovery limit exceeded');
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules','.git','.next','dist','build'].includes(ent.name)) continue;
    const path = join(dir, ent.name);
    if (ent.isDirectory()) await walk(path, depth + 1);
    else if (ent.isFile() && /\.(test|spec)\.(mjs|cjs|js)$/.test(ent.name)) files.push(path);
  }
}
try {
  await walk('/work');
  if (!files.length) {
    process.stderr.write('No supported JavaScript test files found; no pass can be recorded.\n');
    process.exitCode = 2;
  } else {
    const proc = spawn(process.execPath, ['--test', ...files], { cwd: '/work', stdio: 'inherit' });
    proc.on('error', err => { process.stderr.write(err.message); process.exitCode = 2; });
    proc.on('close', code => { process.exitCode = code ?? 2; });
  }
} catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 2; }
