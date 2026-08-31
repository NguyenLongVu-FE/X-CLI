import { describe, expect, it } from 'vitest';

import { XTransport } from '../src/api/transport.js';
import type { CredentialStore, OAuthTokens } from '../src/auth/credentials.js';

const tokens: OAuthTokens = { accessToken: 'secret-a', refreshToken: 'secret-r', expiresAt: Date.now() + 60_000, scope: [] };
const store: CredentialStore = { get: async () => tokens, set: async () => {}, delete: async () => {} };

describe('X API transport', () => {
  it('adds bearer auth and returns rate-limit metadata', async () => {
    let authorization = '';
    const transport = new XTransport({ store, refresh: async () => tokens, fetch: async (_url, init) => {
      authorization = new Headers(init?.headers).get('authorization') ?? '';
      return new Response(JSON.stringify({ data: { id: '1' } }), { status: 200, headers: { 'x-rate-limit-remaining': '9' } });
    }});
    const result = await transport.request<{ data: { id: string } }>({ method: 'GET', path: '/users/me', kind: 'read' });
    expect(authorization).toBe('Bearer secret-a');
    expect(result.rateLimit.remaining).toBe(9);
  });

  it('refreshes once after 401', async () => {
    let calls = 0; let refreshes = 0;
    const transport = new XTransport({ store, refresh: async () => { refreshes += 1; return { ...tokens, accessToken: 'new' }; }, fetch: async () => {
      calls += 1; return calls === 1 ? new Response('{}', { status: 401 }) : new Response('{"data":{}}', { status: 200 });
    }});
    await transport.request({ method: 'GET', path: '/users/me', kind: 'read' });
    expect({ calls, refreshes }).toEqual({ calls: 2, refreshes: 1 });
  });

  it('retries one transient read but never retries a write', async () => {
    let reads = 0;
    const readTransport = new XTransport({ store, refresh: async () => tokens, fetch: async () => {
      reads += 1; if (reads === 1) throw new Error('socket'); return new Response('{"data":{}}', { status: 200 });
    }});
    await readTransport.request({ method: 'GET', path: '/users/me', kind: 'read' });
    expect(reads).toBe(2);
    let writes = 0;
    const writeTransport = new XTransport({ store, refresh: async () => tokens, fetch: async () => { writes += 1; throw new Error('socket'); }});
    await expect(writeTransport.request({ method: 'POST', path: '/tweets', kind: 'write', body: {} })).rejects.toThrow('outcome may be unknown');
    expect(writes).toBe(1);
  });

  it('maps rate limits without including credentials', async () => {
    const transport = new XTransport({ store, refresh: async () => tokens, fetch: async () => new Response('{"detail":"slow"}', { status: 429 }) });
    await expect(transport.request({ method: 'GET', path: '/users/me', kind: 'read' })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
