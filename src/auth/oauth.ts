import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

import type { CredentialStore, OAuthTokens } from './credentials.js';
import { createPkce, type PkceValues } from './pkce.js';
import { receiveOAuthCallback, type OAuthCallback } from './callback.js';
import { XCliError } from '../errors.js';

export const REQUIRED_SCOPES = [
  'tweet.read', 'tweet.write', 'users.read', 'like.read', 'like.write', 'follows.read', 'follows.write', 'offline.access'
] as const;
const REDIRECT_URI = 'http://127.0.0.1:8787/callback';
const tokenSchema = z.object({
  access_token: z.string().min(1), refresh_token: z.string().min(1), expires_in: z.number().positive(), scope: z.string()
});

export interface OAuthDependencies {
  store: CredentialStore;
  fetch: typeof globalThis.fetch;
  openBrowser: (url: string) => Promise<void>;
  receiveCallback: () => Promise<OAuthCallback>;
  createPkce?: () => PkceValues;
  now?: () => number;
}

interface BrowserOpenerOptions {
  manual: boolean;
  write: (value: string) => void;
  open: (url: string) => Promise<void>;
}

export function createBrowserOpener(options: BrowserOpenerOptions): (url: string) => Promise<void> {
  return async (url) => {
    if (options.manual) {
      options.write(`Open this URL in a browser:\n${url}\n`);
      return;
    }
    await options.open(url);
  };
}

export class OAuthClient {
  constructor(private readonly clientId: string, private readonly dependencies: OAuthDependencies) {}

  async login(): Promise<{ authenticated: true; expiresAt: number; scope: string[] }> {
    const pkce = (this.dependencies.createPkce ?? createPkce)();
    const url = new URL('https://x.com/i/oauth2/authorize');
    for (const [key, value] of Object.entries({
      response_type: 'code', client_id: this.clientId, redirect_uri: REDIRECT_URI,
      scope: REQUIRED_SCOPES.join(' '), state: pkce.state,
      code_challenge: pkce.challenge, code_challenge_method: 'S256'
    })) url.searchParams.set(key, value);
    await this.dependencies.openBrowser(url.toString());
    const callback = await this.dependencies.receiveCallback();
    if (callback.state !== pkce.state) throw new XCliError('AUTH_REQUIRED', 'OAuth state mismatch', 2);
    const tokens = await this.exchange(new URLSearchParams({
      grant_type: 'authorization_code', code: callback.code, redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier, client_id: this.clientId
    }));
    await this.dependencies.store.set(tokens);
    return { authenticated: true, expiresAt: tokens.expiresAt, scope: tokens.scope };
  }

  async refresh(): Promise<OAuthTokens> {
    const current = await this.dependencies.store.get();
    if (!current) throw new XCliError('AUTH_REQUIRED', 'Run x auth login first', 2);
    const tokens = await this.exchange(new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: current.refreshToken, client_id: this.clientId
    }));
    await this.dependencies.store.set(tokens);
    return tokens;
  }

  async status(): Promise<{ authenticated: false } | { authenticated: true; expiresAt: number; scope: string[] }> {
    const tokens = await this.dependencies.store.get();
    return tokens ? { authenticated: true, expiresAt: tokens.expiresAt, scope: tokens.scope } : { authenticated: false };
  }

  async logout(): Promise<void> { await this.dependencies.store.delete(); }

  private async exchange(body: URLSearchParams): Promise<OAuthTokens> {
    const response = await this.dependencies.fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body
    });
    if (!response.ok) throw new XCliError('AUTH_REQUIRED', `OAuth token exchange failed with HTTP ${response.status}`, 2);
    const parsed = tokenSchema.safeParse(await response.json());
    if (!parsed.success) throw new XCliError('AUTH_REQUIRED', 'OAuth token response was invalid', 2);
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: (this.dependencies.now ?? Date.now)() + parsed.data.expires_in * 1_000,
      scope: parsed.data.scope.split(' ').filter(Boolean)
    };
  }
}

export function createOAuthClient(clientId: string, store: CredentialStore): OAuthClient {
  return new OAuthClient(clientId, {
    store, fetch: globalThis.fetch,
    openBrowser: createBrowserOpener({
      manual: process.env.X_OAUTH_MANUAL === '1',
      write: (value) => { process.stderr.write(value); },
      open: async (url) => { await promisify(execFile)('/usr/bin/open', [url]); }
    }),
    receiveCallback: () => receiveOAuthCallback()
  });
}
