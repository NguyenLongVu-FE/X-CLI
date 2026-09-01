import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { BrowserLock } from '../src/browser/lock.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function lockFixture(isProcessAlive: (pid: number) => boolean = () => true) {
  const root = await mkdtemp(join(tmpdir(), 'x-browser-lock-'));
  roots.push(root);
  const path = join(root, 'browser.lock');
  return { path, lock: new BrowserLock(path, { pid: 101, now: () => 1000, isProcessAlive }) };
}

describe('browser process lock', () => {
  it('rejects a second command while the owner is live', async () => {
    const { lock } = await lockFixture();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const acquired = new Promise<void>((resolve) => { entered = resolve; });
    const first = lock.withLock(async () => { entered(); return gate; });
    await acquired;
    await expect(lock.withLock(async () => 'second')).rejects.toMatchObject({ code: 'BROWSER_BUSY' });
    release();
    await first;
  });

  it('recovers a lock whose process no longer exists', async () => {
    const { path, lock } = await lockFixture(() => false);
    await writeFile(path, JSON.stringify({ pid: 999, startedAt: 1, token: 'stale' }), { mode: 0o600 });
    await expect(lock.withLock(async () => 'recovered')).resolves.toBe('recovered');
  });

  it('does not delete a lock replaced by another owner', async () => {
    const { path, lock } = await lockFixture();
    await lock.withLock(async () => {
      await writeFile(path, JSON.stringify({ pid: 202, startedAt: 2, token: 'replacement' }), { mode: 0o600 });
    });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ pid: 202, startedAt: 2, token: 'replacement' });
  });
});
