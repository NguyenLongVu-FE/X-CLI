import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { BrowserBindingStore } from '../src/browser/config.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<{ root: string; path: string; store: BrowserBindingStore }> {
  const root = await mkdtemp(join(tmpdir(), 'x-browser-config-'));
  roots.push(root);
  const path = join(root, 'nested', 'config.json');
  return { root, path, store: new BrowserBindingStore(path) };
}

describe('browser account binding', () => {
  it('returns null before an account is bound', async () => {
    const { store } = await fixture();
    expect(await store.get()).toBeNull();
  });

  it('persists only the expected username and browser key with private permissions', async () => {
    const { path, store } = await fixture();
    await store.set({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' });
    expect(await store.get()).toEqual({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('fails loud for malformed or unsafe configuration', async () => {
    const { path, store } = await fixture();
    await expect(store.set({ expectedUsername: '@bad username', browserKey: 'install:Chrome:abc' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(store.set({ expectedUsername: 'imtamhn', browserKey: 'bad key with spaces' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await store.set({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' });
    await writeFile(path, '{not-json', { mode: 0o600 });
    await expect(store.get()).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
