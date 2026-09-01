import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
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
  const bundledPlaywriter = join(clone, 'node_modules', '.bin', 'playwriter');
  await unlink(bundledPlaywriter);
  await writeFile(bundledPlaywriter, '#!/bin/sh\nprintf \'KEY  TYPE  BROWSER  PROFILE\\ninstall:Chrome:test  extension  Chrome  test@example.com\\n\'\n');
  await chmod(bundledPlaywriter, 0o755);
  const runtimeBin = join(temporary, 'runtime-bin');
  await mkdir(runtimeBin);
  await symlink(process.execPath, join(runtimeBin, 'node'));
  await run(join(bin, 'x'), ['browser', 'list'], clone, {
    ...process.env,
    PATH: `${runtimeBin}${delimiter}/usr/bin${delimiter}/bin`
  });
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
