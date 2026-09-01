import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('Mac installer', () => {
  it('never replaces an existing non-symlink command', async () => {
    const bin = await mkdtemp(join(tmpdir(), 'x-cli-install-'));
    roots.push(bin);
    const command = join(bin, 'x');
    await writeFile(command, 'existing command');
    await expect(exec('pnpm', ['tsx', 'scripts/install-macos.ts'], { cwd: process.cwd(), env: { ...process.env, XCLI_BIN_DIR: bin } }))
      .rejects.toMatchObject({ stderr: expect.stringContaining('Refusing to replace non-symlink') });
    expect(await readFile(command, 'utf8')).toBe('existing command');
  });
});
