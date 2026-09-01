import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BrowserXClient } from '../src/browser/client.js';
import type { BrowserOperation, BrowserReadEnvelope } from '../src/browser/types.js';

const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'x');
const fixture = async <T>(name: string): Promise<T> => JSON.parse(await readFile(join(fixtureRoot, name), 'utf8')) as T;
const account = { url: 'https://x.com/home', profileHref: '/imtamhn', displayName: 'Tam', snapshot: 'authenticated' };

function setup(values: unknown[]) {
  const operations: BrowserOperation[] = [];
  const runner = {
    listBrowsers: async () => [],
    run: async <T>(operation: BrowserOperation): Promise<T> => {
      operations.push(operation);
      return values.shift() as T;
    }
  };
  const client = new BrowserXClient(runner, { get: async () => ({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:sabrina' }) });
  return { client, operations };
}

const ok = <T>(value: T): BrowserReadEnvelope<T> => ({ account, state: 'ok', value });

describe('Playwriter browser reads', () => {
  it('keeps For You distinct and deduplicates posts by canonical status URL', async () => {
    const { client, operations } = setup([ok(await fixture('feed-for-you.txt'))]);

    await expect(client.forYouFeed(2)).resolves.toEqual([
      expect.objectContaining({ id: '101', url: 'https://x.com/alice/status/101', authorUsername: 'alice', metrics: { replies: 2, likes: 1200 } }),
      expect.objectContaining({ id: '202', url: 'https://x.com/bob/status/202', authorUsername: 'bob' })
    ]);
    expect(operations).toEqual([{ kind: 'read-feed', feed: 'for-you', limit: 2, expectedUsername: 'imtamhn' }]);
  });

  it('requests the Following tab without silently substituting For You', async () => {
    const { client, operations } = setup([ok(await fixture('feed-following.txt'))]);

    await expect(client.followingFeed(5)).resolves.toEqual([
      expect.objectContaining({ id: '303', authorUsername: 'carol' })
    ]);
    expect(operations[0]).toMatchObject({ kind: 'read-feed', feed: 'following', limit: 5 });
  });

  it('normalizes search, post, user, and following reads', async () => {
    const { client } = setup([
      ok(await fixture('search.txt')),
      ok(await fixture('post.txt')),
      ok(await fixture('user.txt')),
      ok({ ...(await fixture<Record<string, unknown>>('user.txt')), following: true })
    ]);

    await expect(client.searchPosts('builder', 10)).resolves.toEqual([expect.objectContaining({ id: '404' })]);
    await expect(client.getPost('101')).resolves.toMatchObject({ id: '101', text: 'First post' });
    await expect(client.getUser('Sabrina')).resolves.toMatchObject({ id: 'sabrina', username: 'sabrina', name: 'Sabrina' });
    await expect(client.isFollowing('Sabrina')).resolves.toEqual({ username: 'sabrina', userId: 'sabrina', following: true });
  });

  it('omits inaccessible optional metrics instead of inventing zeroes', async () => {
    const { client } = setup([ok([{ url: '/a/status/1', text: 'hi', authorUsername: 'a', metrics: { likes: null, views: '—' } }])]);
    await expect(client.forYouFeed(1)).resolves.toEqual([
      { id: '1', url: 'https://x.com/a/status/1', text: 'hi', authorUsername: 'a' }
    ]);
  });

  it('distinguishes a visibly missing target from an unknown X layout', async () => {
    const missing = setup([{ account, state: 'not-found' }]);
    await expect(missing.client.getPost('999')).rejects.toMatchObject({ code: 'TARGET_NOT_FOUND' });

    const changed = setup([{ account, state: 'ok', value: null }]);
    await expect(changed.client.getPost('999')).rejects.toMatchObject({ code: 'X_UI_CHANGED' });
  });
});
