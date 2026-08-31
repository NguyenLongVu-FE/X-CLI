import { describe, expect, it } from 'vitest';

import { XClient } from '../src/api/reads.js';
import type { ApiRequest, ApiResult } from '../src/api/types.js';

class FakeTransport {
  readonly requests: ApiRequest[] = [];
  constructor(private readonly responses: unknown[]) {}
  async request<T>(request: ApiRequest): Promise<ApiResult<T>> {
    this.requests.push(request);
    return { data: this.responses.shift() as T, rateLimit: {}, status: 200 };
  }
}

describe('X read operations', () => {
  it('normalizes the authenticated user', async () => {
    const transport = new FakeTransport([{ data: { id: '1', name: 'Tam', username: 'imtamhn' } }]);
    await expect(new XClient(transport).me()).resolves.toEqual({ id: '1', name: 'Tam', username: 'imtamhn' });
    expect(transport.requests[0]?.path).toContain('/users/me');
  });

  it('reads the reverse chronological following timeline and caches account ID', async () => {
    const transport = new FakeTransport([
      { data: { id: '1', name: 'Tam', username: 'imtamhn' } },
      { data: [{ id: '10', text: 'hello', author_id: '2' }], meta: {} },
      { data: [], meta: {} }
    ]);
    const client = new XClient(transport);
    expect(await client.followingTimeline(5)).toEqual([{ id: '10', text: 'hello', authorId: '2' }]);
    await client.homeTimeline(5);
    expect(transport.requests.filter((request) => request.path.startsWith('/users/me'))).toHaveLength(1);
    expect(transport.requests[1]?.path).toContain('/users/1/timelines/reverse_chronological');
  });

  it('searches and reads posts and users through documented endpoints', async () => {
    const transport = new FakeTransport([
      { data: [{ id: '10', text: 'AI' }], meta: {} },
      { data: { id: '10', text: 'AI' } },
      { data: { id: '2', name: 'Sabrina', username: 'sabrina' } }
    ]);
    const client = new XClient(transport);
    expect(await client.searchPosts('AI', 20)).toHaveLength(1);
    expect(await client.getPost('10')).toMatchObject({ id: '10', text: 'AI' });
    expect(await client.getUser('sabrina')).toMatchObject({ id: '2', username: 'sabrina' });
    expect(transport.requests.map((request) => request.path)).toEqual(expect.arrayContaining([
      expect.stringContaining('/tweets/search/recent'), expect.stringContaining('/tweets/10'), expect.stringContaining('/users/by/username/sabrina')
    ]));
  });

  it('returns an empty collection when X omits data', async () => {
    await expect(new XClient(new FakeTransport([{ meta: {} }])).searchPosts('none', 10)).resolves.toEqual([]);
  });

  it('reports a missing singular resource as NOT_FOUND instead of leaking a TypeError', async () => {
    await expect(new XClient(new FakeTransport([{ errors: [{ detail: 'not found' }] }])).getPost('deleted')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('checks following status across official API pages', async () => {
    const transport = new FakeTransport([
      { data: { id: '2', name: 'Target', username: 'target' } },
      { data: { id: '1', name: 'Tam', username: 'imtamhn' } },
      { data: [{ id: '3', username: 'other' }], meta: { next_token: 'next' } },
      { data: [{ id: '2', username: 'target' }], meta: {} }
    ]);
    await expect(new XClient(transport).isFollowing('target')).resolves.toEqual({
      username: 'target', userId: '2', following: true
    });
    expect(transport.requests.map((request) => request.path)).toEqual(expect.arrayContaining([
      expect.stringContaining('/users/1/following?'),
      expect.stringContaining('pagination_token=next')
    ]));
  });

  it('reports false when the target is absent from every following page', async () => {
    const transport = new FakeTransport([
      { data: { id: '2', name: 'Target', username: 'target' } },
      { data: { id: '1', name: 'Tam', username: 'imtamhn' } },
      { data: [], meta: {} }
    ]);
    await expect(new XClient(transport).isFollowing('target')).resolves.toMatchObject({ following: false });
  });
});
