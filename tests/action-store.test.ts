import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionPlanner } from '../src/actions/planner.js';
import { ActionStore } from '../src/actions/store.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture(now = 1_000) {
  const root = await mkdtemp(join(tmpdir(), 'x-action-store-')); roots.push(root);
  const store = new ActionStore(root, () => now);
  const preview = await new ActionPlanner(store, () => 1_000).plan({ kind: 'like', target: { postId: '10' } }, 'account-1');
  return { root, store, preview };
}

describe('action store', () => {
  it('writes previews with mode 0600', async () => {
    const { root, preview } = await fixture();
    expect((await stat(join(root, `${preview.id}.json`))).mode & 0o777).toBe(0o600);
  });

  it('rejects expired, changed, or wrong-account previews', async () => {
    const expired = await fixture(400_000);
    await expect(expired.store.consume(expired.preview.id, 'account-1')).rejects.toMatchObject({ code: 'ACTION_EXPIRED' });
    const changed = await fixture();
    const path = join(changed.root, `${changed.preview.id}.json`);
    const data = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    data.target = { postId: '99' }; await writeFile(path, JSON.stringify(data)); await chmod(path, 0o600);
    await expect(changed.store.consume(changed.preview.id, 'account-1')).rejects.toMatchObject({ code: 'ACTION_CHANGED' });
    const wrong = await fixture();
    await expect(wrong.store.consume(wrong.preview.id, 'account-2')).rejects.toMatchObject({ code: 'ACTION_CHANGED' });
  });

  it('allows exactly one concurrent consumption', async () => {
    const { store, preview } = await fixture();
    const results = await Promise.allSettled([store.consume(preview.id, 'account-1'), store.consume(preview.id, 'account-1')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });
});
