import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), 'x-cli-git-install-'));

try {
  await rm(join(root, 'dist'), { recursive: true, force: true });
  await run('npm', ['install', '-g', '--prefix', join(temporary, 'prefix'), root]);
  await run(join(temporary, 'prefix', 'bin', 'x'), ['--help']);
  process.stdout.write('git install smoke passed\n');
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function run(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: 'pipe' });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${file} failed (${code}): ${stderr.trim()}`)));
  });
}
