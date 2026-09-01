import { describe, expect, it } from 'vitest';

import type { ActionKind, ActionPreview } from '../src/actions/types.js';
import { BrowserXWriter } from '../src/browser/writer.js';
import type { BrowserOperation, BrowserWriteEnvelope } from '../src/browser/types.js';

const account = { url: 'https://x.com/home', profileHref: '/imtamhn', displayName: 'Tam', snapshot: 'authenticated' };
const base = { version: 1 as const, id: 'act_123', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'hash' };

function action(kind: ActionKind): ActionPreview {
  if (kind === 'post-create') return { ...base, kind, target: {}, text: 'hello' };
  if (kind === 'reply') return { ...base, kind, target: { postId: '10' }, text: 'thanks' };
  if (kind === 'follow' || kind === 'unfollow') return { ...base, kind, target: { username: 'sabrina', userId: 'sabrina' } };
  return { ...base, kind, target: { postId: '10' } };
}

function setup(results: BrowserWriteEnvelope[]) {
  const operations: BrowserOperation[] = [];
  const runner = {
    run: async <T>(operation: BrowserOperation): Promise<T> => {
      operations.push(operation);
      return results.shift() as T;
    }
  };
  const bindings = { get: async () => ({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:sabrina' }) };
  return { writer: new BrowserXWriter(runner, bindings), operations };
}

describe('Playwriter browser writes', () => {
  it('executes all seven legacy action kinds through exactly one browser operation', async () => {
    const kinds: ActionKind[] = ['post-create', 'post-delete', 'reply', 'like', 'unlike', 'follow', 'unfollow'];
    const results = kinds.map((): BrowserWriteEnvelope => ({ account, outcome: 'confirmed' }));
    const { writer, operations } = setup(results);

    for (const kind of kinds) await expect(writer.execute(action(kind))).resolves.toEqual({ outcome: 'confirmed' });
    expect(operations).toEqual(kinds.map((kind) => ({ kind: 'write', action: action(kind) })));
  });

  it('returns an ambiguous result once and never retries the browser action', async () => {
    const { writer, operations } = setup([{ account, outcome: 'unknown' }]);
    await expect(writer.execute(action('like'))).resolves.toEqual({ outcome: 'unknown' });
    expect(operations).toHaveLength(1);
  });

  it('rejects an account mismatch before a browser write is started', async () => {
    const { writer, operations } = setup([]);
    await expect(writer.execute({ ...action('like'), accountId: 'someone_else' })).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(operations).toHaveLength(0);
  });

  it('stops on visible warnings and account challenges', async () => {
    const warning = setup([{ account, blocked: 'warning' }]);
    await expect(warning.writer.execute(action('like'))).rejects.toMatchObject({ code: 'ACTION_UNKNOWN' });

    const challenged = setup([{ account: { ...account, url: 'https://x.com/account/access', snapshot: 'Verify your identity' }, outcome: 'unknown' }]);
    await expect(challenged.writer.execute(action('like'))).rejects.toMatchObject({ code: 'CHALLENGE_REQUIRED' });
  });
});
