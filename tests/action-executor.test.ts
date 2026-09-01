import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionExecutor } from '../src/actions/executor.js';
import { ActionPlanner } from '../src/actions/planner.js';
import { ActionStore } from '../src/actions/store.js';
import { XCliError } from '../src/errors.js';

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

  it('leaves the preview available when account verification fails before consume', async () => {
    const root = await mkdtemp(join(tmpdir(), 'x-executor-')); roots.push(root);
    const store = new ActionStore(root, () => 1_000);
    const action = await new ActionPlanner(store, () => 1_000).plan({ kind: 'like', target: { postId: '10' } }, 'me');
    const mismatch = new ActionExecutor(store, async () => { throw new XCliError('ACCOUNT_MISMATCH', 'wrong account'); }, {
      execute: async () => ({ outcome: 'confirmed' as const })
    });

    await expect(mismatch.execute(action.id)).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    const verified = new ActionExecutor(store, async () => 'me', { execute: async () => ({ outcome: 'confirmed' as const }) });
    await expect(verified.execute(action.id)).resolves.toMatchObject({ outcome: 'confirmed' });
  });

  it('validates media before consuming the approved preview', async () => {
    const root = await mkdtemp(join(tmpdir(), 'x-executor-')); roots.push(root);
    const store = new ActionStore(root, () => 1_000);
    const action = await new ActionPlanner(store, () => 1_000).plan({ kind: 'post-create', target: {}, text: 'Photo' }, 'me');
    const blocked = new ActionExecutor(store, async () => 'me', {
      validate: async () => { throw new XCliError('ACTION_TAMPERED', 'changed media'); },
      execute: async () => ({ outcome: 'confirmed' as const })
    });
    await expect(blocked.execute(action.id)).rejects.toMatchObject({ code: 'ACTION_TAMPERED' });

    const verified = new ActionExecutor(store, async () => 'me', { execute: async () => ({ outcome: 'confirmed' as const }) });
    await expect(verified.execute(action.id)).resolves.toMatchObject({ outcome: 'confirmed' });
  });
});
