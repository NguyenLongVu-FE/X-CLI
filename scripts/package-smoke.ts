import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'x-cli-package-'));
  const packed = join(root, 'packed');
  const installed = join(root, 'installed');
  try {
    await mkdir(packed); await mkdir(installed);
    await writeFile(join(installed, 'package.json'), '{"type":"module"}\n');
    const { stdout } = await exec('pnpm', ['pack', '--pack-destination', packed, '--json'], { cwd: process.cwd() });
    const jsonStart = stdout.indexOf('{');
    if (jsonStart === -1) throw new Error('pnpm pack did not return JSON metadata');
    const metadata = JSON.parse(stdout.slice(jsonStart)) as { files: { path: string }[] };
    const files = metadata.files.map((file) => file.path);
    for (const file of files) {
      assert(
        file === 'package.json' || file === 'README.md' || file === 'LICENSE' || file.startsWith('dist/') && !file.startsWith('dist/src/') && !file.startsWith('dist/scripts/') || file.startsWith('skills/'),
        `tarball contains an unintended file: ${file}`
      );
    }
    for (const required of ['package.json', 'README.md', 'LICENSE', 'dist/cli.js', 'dist/index.js', 'skills/x-cli/SKILL.md']) {
      assert(files.includes(required), `tarball is missing ${required}`);
    }
    const [tarball] = await readdir(packed);
    if (tarball === undefined || !tarball.endsWith('.tgz')) throw new Error('pnpm pack did not create a tarball');
    await exec('npm', ['install', join(packed, tarball)], { cwd: installed });
    const direct = await exec(join(installed, 'node_modules', '.bin', 'x'), ['--help'], { cwd: installed });
    assert.match(direct.stdout, /action execute/, 'direct npm bin symlink did not run the CLI entrypoint');
    const help = await exec('npx', ['--no-install', 'x', '--help'], { cwd: installed });
    assert.match(help.stdout, /action execute/);
    await exec(process.execPath, ['--input-type=module', '--eval', "import('@nguyenlongvu-fe/x-cli').then((m) => { if (!m.BrowserXClient) throw new Error('missing BrowserXClient') })"], { cwd: installed });
    process.stdout.write('package smoke passed\n');
  } finally { await rm(root, { recursive: true, force: true }); }
}

void main().catch((error: unknown) => {
  const value = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  const message = typeof value.message === 'string' ? value.message : 'unknown';
  const stderr = typeof value.stderr === 'string' ? value.stderr.trim() : '';
  const stdout = typeof value.stdout === 'string' ? value.stdout.trim() : '';
  process.stderr.write(`package smoke failed: ${message}${stdout === '' ? '' : `\n${stdout}`}${stderr === '' ? '' : `\n${stderr}`}\n`);
  process.exitCode = 1;
});
