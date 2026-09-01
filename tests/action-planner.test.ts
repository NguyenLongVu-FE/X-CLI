import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionPlanner } from '../src/actions/planner.js';
import { ActionStore } from '../src/actions/store.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('action planner', () => {
  it('creates a five-minute, account-bound preview with no token fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'x-action-')); roots.push(root);
    const planner = new ActionPlanner(new ActionStore(root, () => 1_000), () => 1_000);
    const preview = await planner.plan({ kind: 'reply', target: { postId: '10' }, text: 'Thanks' }, 'account-1');
    expect(preview).toMatchObject({ version: 1, accountId: 'account-1', kind: 'reply', expiresAt: 301_000 });
    expect(JSON.stringify(preview)).not.toMatch(/token|secret/i);
  });

  it('includes immutable media descriptors in the signed preview without file bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'x-action-')); roots.push(root);
    const planner = new ActionPlanner(new ActionStore(root, () => 1_000), () => 1_000);
    const media = [{ path: '/tmp/image.png', size: 3, sha256: 'abc' }];
    const preview = await planner.plan({ kind: 'post-create', target: {}, text: 'Photo', media }, 'account-1');
    expect(preview.media).toEqual(media);
    expect(JSON.stringify(preview)).not.toContain('data:');
  });
});
