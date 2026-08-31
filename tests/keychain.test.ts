import { describe, expect, it } from 'vitest';

import { MacOsKeychainStore, type KeychainEntry } from '../src/auth/keychain.js';
import type { OAuthTokens } from '../src/auth/credentials.js';

const tokens: OAuthTokens = {
  accessToken: `access-${'a'.repeat(300)}`,
  refreshToken: `refresh-${'r'.repeat(300)}`,
  expiresAt: 1234,
  scope: ['tweet.read']
};

function fakeEntry(initial: string | null = null): KeychainEntry & { value: string | null } {
  return {
    value: initial,
    getPassword() { return this.value; },
    setPassword(value) { this.value = value; },
    deletePassword() { this.value = null; }
  };
}

describe('macOS Keychain credential store', () => {
  it('stores and reads the complete token JSON through the native Keychain API', async () => {
    const entry = fakeEntry();
    const store = new MacOsKeychainStore(() => entry);
    await store.set(tokens);
    expect(entry.value).toBe(JSON.stringify(tokens));
    await expect(store.get()).resolves.toEqual(tokens);
  });

  it('returns null when the Keychain item does not exist', async () => {
    await expect(new MacOsKeychainStore(() => fakeEntry()).get()).resolves.toBeNull();
  });

  it('deletes credentials and redacts native failures', async () => {
    const entry = fakeEntry(JSON.stringify(tokens));
    const store = new MacOsKeychainStore(() => entry);
    await store.delete();
    expect(entry.value).toBeNull();

    const failing = new MacOsKeychainStore(() => ({
      getPassword() { throw new Error(tokens.accessToken); },
      setPassword() { throw new Error(tokens.accessToken); },
      deletePassword() { throw new Error(tokens.accessToken); }
    }));
    await expect(failing.get()).rejects.not.toThrow(tokens.accessToken);
  });
});
