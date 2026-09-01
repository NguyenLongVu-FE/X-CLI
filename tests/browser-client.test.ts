import { describe, expect, it } from 'vitest';

import { BrowserXClient } from '../src/browser/client.js';
import type { BrowserBindingStore } from '../src/browser/config.js';
import type { BrowserDescriptor, BrowserOperation } from '../src/browser/types.js';

function runner(result: unknown) {
  const operations: { operation: BrowserOperation; browserKey: string }[] = [];
  return {
    operations,
    listBrowsers: async (): Promise<BrowserDescriptor[]> => [{ key: 'install:Chrome:abc', type: 'extension', browser: 'Chrome', profile: 'itstamhn@gmail.com' }],
    run: async <T>(operation: BrowserOperation, browserKey: string): Promise<T> => {
      operations.push({ operation, browserKey });
      return result as T;
    }
  };
}

function binding(value: Awaited<ReturnType<BrowserBindingStore['get']>>) {
  return { get: async () => value };
}

describe('browser X client', () => {
  it('lists profiles without requiring a binding', async () => {
    const external = runner({});
    const client = new BrowserXClient(external, binding(null));
    await expect(client.listBrowsers()).resolves.toEqual([
      { key: 'install:Chrome:abc', type: 'extension', browser: 'Chrome', profile: 'itstamhn@gmail.com' }
    ]);
  });

  it('uses the bound browser key and expected account for status', async () => {
    const external = runner({ url: 'https://x.com/home', profileHref: '/imtamhn', displayName: 'Tam', snapshot: 'authenticated' });
    const client = new BrowserXClient(external, binding({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' }));
    await expect(client.status()).resolves.toEqual({ connected: true, authenticated: true, username: 'imtamhn' });
    expect(external.operations).toEqual([{
      operation: { kind: 'status', expectedUsername: 'imtamhn' }, browserKey: 'install:Chrome:abc'
    }]);
  });

  it('fails before opening X when no profile is bound', async () => {
    const external = runner({});
    const client = new BrowserXClient(external, binding(null));
    await expect(client.status()).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(external.operations).toHaveLength(0);
  });

  it('returns a stable account identity from the observed profile', async () => {
    const external = runner({ url: 'https://x.com/home', profileHref: '/imtamhn', displayName: 'Tam', snapshot: 'authenticated' });
    const client = new BrowserXClient(external, binding({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' }));
    await expect(client.me()).resolves.toEqual({ id: 'imtamhn', name: 'Tam', username: 'imtamhn' });
  });
});
