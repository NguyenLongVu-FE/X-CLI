import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionExecutor } from '../src/actions/executor.js';
import { ActionPlanner } from '../src/actions/planner.js';
import { ActionStore } from '../src/actions/store.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('action executor', () => {
  it('consumes one approved action and cannot execute it twice', async () => {
    const root = await mkdtemp(join(tmpdir(), 'x-executor-')); roots.push(root);
    const store = new ActionStore(root, () => 1_000);
    const action = await new ActionPlanner(store, () => 1_000).plan({ kind: 'like', target: { postId: '10' } }, 'me');
    let calls = 0;
    const executor = new ActionExecutor(store, async () => 'me', { execute: async () => { calls += 1; return { outcome: 'confirmed' as const }; } });
    await expect(executor.execute(action.id)).resolves.toMatchObject({ outcome: 'confirmed', kind: 'like' });
    await expect(executor.execute(action.id)).rejects.toMatchObject({ code: 'ACTION_CHANGED' });
    expect(calls).toBe(1);
  });
});
