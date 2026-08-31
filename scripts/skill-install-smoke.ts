import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'x-cli-skill-'));
  const packed = join(root, 'packed'); const unpacked = join(root, 'unpacked'); const installed = join(root, 'installed');
  try {
    await Promise.all([mkdir(packed), mkdir(unpacked), mkdir(installed)]);
    await exec('pnpm', ['pack', '--pack-destination', packed], { cwd: process.cwd() });
    const [tarball] = await readdir(packed);
    if (tarball === undefined || !tarball.endsWith('.tgz')) throw new Error('pnpm pack did not create a tarball');
    await exec('tar', ['-xzf', join(packed, tarball), '-C', unpacked]);
    await exec('npx', ['-y', 'skills', 'add', join(unpacked, 'package'), '--skill', 'x-cli', '--agent', 'codex', '--copy', '-y'], { cwd: installed });
    const { stdout } = await exec('npx', ['-y', 'skills', 'list', '--json'], { cwd: installed });
    assert.match(stdout, /"name"\s*:\s*"x-cli"/);
    process.stdout.write('skill install smoke passed\n');
  } finally { await rm(root, { recursive: true, force: true }); }
}

void main().catch((error: unknown) => { process.stderr.write(`skill install smoke failed: ${error instanceof Error ? error.message : 'unknown'}\n`); process.exitCode = 1; });
