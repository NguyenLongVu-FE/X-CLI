import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionStore } from '../src/actions/store.js';
import type { ActionPreview } from '../src/actions/types.js';
import { BulkExecutor } from '../src/bulk/executor.js';
import { BulkPlanner } from '../src/bulk/planner.js';
import { XCliError } from '../src/errors.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function setup(actions: unknown[]) {
  const root = await mkdtemp(join(tmpdir(), 'x-bulk-')); roots.push(root);
  const store = new ActionStore(root, () => 1_000);
  const planner = new BulkPlanner(store, () => 1_000);
  const preview = await planner.planValue({ version: 1, account: 'imtamhn', actions }, 'imtamhn');
  return { root, store, preview };
}

describe('bounded bulk executor', () => {
  it('waits five seconds between actions and persists each confirmed result', async () => {
    const { store, preview } = await setup([{ kind: 'like', postId: '10' }, { kind: 'unlike', postId: '10' }]);
    const delays: number[] = [];
    const executor = new BulkExecutor(store, async () => 'imtamhn', {
      execute: async () => ({ outcome: 'confirmed' as const })
    }, async (milliseconds) => { delays.push(milliseconds); });

    await expect(executor.execute(preview.id)).resolves.toMatchObject({ stopped: false, results: [
      { index: 0, kind: 'like', outcome: 'confirmed' }, { index: 1, kind: 'unlike', outcome: 'confirmed' }
    ] });
    expect(delays).toEqual([5_000]);
    await expect(store.readBulkResult(preview.id)).resolves.toMatchObject({ stopped: false, results: [{ index: 0 }, { index: 1 }] });
  });

  it('stops immediately after a challenge and never executes a later action', async () => {
    const { store, preview } = await setup([
      { kind: 'like', postId: '10' }, { kind: 'follow', username: 'sabrina' }, { kind: 'bookmark-add', postId: '11' }
    ]);
    const calls: ActionPreview[] = [];
    const delays: number[] = [];
    const executor = new BulkExecutor(store, async () => 'imtamhn', {
      execute: async (action) => {
        calls.push(action);
        if (action.kind === 'follow') throw new XCliError('CHALLENGE_REQUIRED', 'challenge');
        return { outcome: 'confirmed' as const };
      }
    }, async (milliseconds) => { delays.push(milliseconds); });

    await expect(executor.execute(preview.id)).resolves.toMatchObject({
      stopped: true,
      stopCode: 'CHALLENGE_REQUIRED',
      results: [{ index: 0, outcome: 'confirmed' }, { index: 1, outcome: 'unknown', error: 'CHALLENGE_REQUIRED' }]
    });
    expect(calls.map((action) => action.kind)).toEqual(['like', 'follow']);
    expect(delays).toEqual([5_000]);
  });

  it('stops on an unknown observation and consumes a preview only once', async () => {
    const { store, preview } = await setup([{ kind: 'like', postId: '10' }, { kind: 'unlike', postId: '10' }]);
    const executor = new BulkExecutor(store, async () => 'imtamhn', {
      execute: async () => ({ outcome: 'unknown' as const })
    }, async () => {});
    await expect(executor.execute(preview.id)).resolves.toMatchObject({ stopped: true, stopCode: 'ACTION_UNKNOWN' });
    await expect(executor.execute(preview.id)).rejects.toMatchObject({ code: 'ACTION_CHANGED' });
  });

  it('rejects an account mismatch and a modified preview before browser writes', async () => {
    const mismatchRoot = await mkdtemp(join(tmpdir(), 'x-bulk-')); roots.push(mismatchRoot);
    const mismatchStore = new ActionStore(mismatchRoot, () => 1_000);
    await expect(new BulkPlanner(mismatchStore, () => 1_000).planValue({ version: 1, account: 'someone_else', actions: [{ kind: 'like', postId: '10' }] }, 'imtamhn'))
      .rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });

    const { root, store, preview } = await setup([{ kind: 'like', postId: '10' }]);
    const path = join(root, `${preview.id}.json`);
    const changed = JSON.parse(await readFile(path, 'utf8')) as { actions: Array<{ target: { postId: string } }> };
    changed.actions[0]!.target.postId = '99';
    await writeFile(path, JSON.stringify(changed));
    let calls = 0;
    const executor = new BulkExecutor(store, async () => 'imtamhn', { execute: async () => { calls += 1; return { outcome: 'confirmed' }; } });
    await expect(executor.execute(preview.id)).rejects.toMatchObject({ code: 'ACTION_CHANGED' });
    expect(calls).toBe(0);
  });
});
