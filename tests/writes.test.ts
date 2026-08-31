import { describe, expect, it } from 'vitest';

import { XWrites } from '../src/api/writes.js';
import type { ActionPreview } from '../src/actions/types.js';
import type { ApiRequest, ApiResult } from '../src/api/types.js';

class FakeTransport {
  readonly requests: ApiRequest[] = [];
  async request<T>(request: ApiRequest): Promise<ApiResult<T>> {
    this.requests.push(request); return { data: { data: { id: 'new' } } as T, rateLimit: {}, status: 200 };
  }
}

const base = { version: 1 as const, id: 'act_123', accountId: 'me', createdAt: 1, expiresAt: 2, hash: 'hash' };

describe('X write endpoints', () => {
  it('maps create and reply to POST /tweets', async () => {
    const transport = new FakeTransport(); const writes = new XWrites(transport);
    await writes.execute({ ...base, kind: 'post-create', target: {}, text: 'hello' });
    await writes.execute({ ...base, kind: 'reply', target: { postId: '10' }, text: 'thanks' });
    expect(transport.requests).toMatchObject([
      { method: 'POST', path: '/tweets', body: { text: 'hello' }, kind: 'write' },
      { method: 'POST', path: '/tweets', body: { text: 'thanks', reply: { in_reply_to_tweet_id: '10' } }, kind: 'write' }
    ]);
  });

  it('maps post deletion to one DELETE request', async () => {
    const transport = new FakeTransport();
    await new XWrites(transport).execute({ ...base, kind: 'post-delete', target: { postId: '10' } });
    expect(transport.requests).toEqual([{ method: 'DELETE', path: '/tweets/10', kind: 'write' }]);
  });

  it('maps like, unlike, follow, and unfollow to one request each', async () => {
    const transport = new FakeTransport(); const writes = new XWrites(transport);
    const actions: ActionPreview[] = [
      { ...base, kind: 'like', target: { postId: '10' } }, { ...base, kind: 'unlike', target: { postId: '10' } },
      { ...base, kind: 'follow', target: { username: 'tam', userId: '2' } }, { ...base, kind: 'unfollow', target: { username: 'tam', userId: '2' } }
    ];
    for (const action of actions) await writes.execute(action);
    expect(transport.requests.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: 'POST', path: '/users/me/likes' }, { method: 'DELETE', path: '/users/me/likes/10' },
      { method: 'POST', path: '/users/me/following' }, { method: 'DELETE', path: '/users/me/following/2' }
    ]);
  });
});
