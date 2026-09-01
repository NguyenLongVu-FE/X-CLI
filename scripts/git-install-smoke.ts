import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), 'x-cli-git-install-'));
const clone = join(temporary, 'clone');
const bin = join(temporary, 'bin');

try {
  await run('git', ['clone', '--local', '--no-hardlinks', root, clone]);
  await run('pnpm', ['install', '--frozen-lockfile'], clone);
  await run('pnpm', ['test:audit'], clone);
  await mkdir(bin);
  await run('pnpm', ['install:mac'], clone, { ...process.env, XCLI_BIN_DIR: bin });
  await run(join(bin, 'x'), ['--help'], clone);
  process.stdout.write('git install smoke passed\n');
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function run(file: string, args: string[], cwd = root, env = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env, stdio: 'pipe' });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${file} failed (${code}): ${stderr.trim()}`)));
  });
}
