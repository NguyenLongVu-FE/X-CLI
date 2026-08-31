import { describe, expect, it } from 'vitest';

import { OAuthClient, REQUIRED_SCOPES } from '../src/auth/oauth.js';
import type { CredentialStore, OAuthTokens } from '../src/auth/credentials.js';

function memoryStore(initial: OAuthTokens | null = null): CredentialStore & { value: OAuthTokens | null } {
  return {
    value: initial,
    async get() { return this.value; },
    async set(value) { this.value = value; },
    async delete() { this.value = null; }
  };
}

describe('OAuth client', () => {
  it('opens an authorization URL with PKCE and the minimum scopes', async () => {
    const store = memoryStore();
    let opened = '';
    const client = new OAuthClient('client-id', {
      store,
      openBrowser: async (url) => { opened = url; },
      receiveCallback: async () => ({ code: 'code-1', state: 'state-1' }),
      createPkce: () => ({ verifier: 'verifier', challenge: 'challenge', state: 'state-1' }),
      fetch: async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 7200, scope: REQUIRED_SCOPES.join(' ') }), { status: 200 }),
      now: () => 1_000
    });
    await client.login();
    const url = new URL(opened);
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize');
    expect(url.searchParams.get('scope')).toBe(REQUIRED_SCOPES.join(' '));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(store.value?.accessToken).toBe('a');
  });

  it('rejects a callback with the wrong state before token exchange', async () => {
    let fetched = false;
    const client = new OAuthClient('client-id', {
      store: memoryStore(), openBrowser: async () => {},
      receiveCallback: async () => ({ code: 'code-1', state: 'wrong' }),
      createPkce: () => ({ verifier: 'v', challenge: 'c', state: 'expected' }),
      fetch: async () => { fetched = true; return new Response(); }, now: () => 0
    });
    await expect(client.login()).rejects.toThrow('state');
    expect(fetched).toBe(false);
  });

  it('rotates refresh tokens and reports status without exposing tokens', async () => {
    const store = memoryStore({ accessToken: 'old-a', refreshToken: 'old-r', expiresAt: 0, scope: ['tweet.read'] });
    const client = new OAuthClient('client-id', {
      store, openBrowser: async () => {}, receiveCallback: async () => ({ code: '', state: '' }),
      fetch: async () => new Response(JSON.stringify({ access_token: 'new-a', refresh_token: 'new-r', expires_in: 100, scope: 'tweet.read' }), { status: 200 }),
      now: () => 5_000
    });
    await client.refresh();
    expect(store.value?.refreshToken).toBe('new-r');
    expect(await client.status()).toEqual({ authenticated: true, expiresAt: 105_000, scope: ['tweet.read'] });
    await client.logout();
    expect(await client.status()).toEqual({ authenticated: false });
  });
});
