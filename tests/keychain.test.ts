import { describe, expect, it } from 'vitest';

import { MacOsKeychainStore, type CommandRunner } from '../src/auth/keychain.js';
import type { OAuthTokens } from '../src/auth/credentials.js';

const tokens: OAuthTokens = {
  accessToken: 'access-secret', refreshToken: 'refresh-secret', expiresAt: 1234, scope: ['tweet.read']
};

describe('macOS Keychain credential store', () => {
  it('passes token JSON through stdin rather than process arguments', async () => {
    const calls: Parameters<CommandRunner>[] = [];
    const runner: CommandRunner = async (...args) => { calls.push(args); return { stdout: '', stderr: '', exitCode: 0 }; };
    await new MacOsKeychainStore(runner).set(tokens);
    expect(calls[0]?.[1]).toEqual(['add-generic-password', '-U', '-s', 'com.nguyenlongvu.x-cli', '-a', 'oauth-tokens', '-w']);
    expect(calls[0]?.[1].join(' ')).not.toContain('access-secret');
    expect(calls[0]?.[2]).toContain('access-secret');
  });

  it('returns null when the Keychain item does not exist', async () => {
    const runner: CommandRunner = async () => ({ stdout: '', stderr: 'not found', exitCode: 44 });
    await expect(new MacOsKeychainStore(runner).get()).resolves.toBeNull();
  });

  it('loads and deletes credentials without exposing secret values in errors', async () => {
    const runner: CommandRunner = async (_file, args) => {
      if (args[0] === 'find-generic-password') return { stdout: JSON.stringify(tokens), stderr: '', exitCode: 0 };
      return { stdout: '', stderr: '', exitCode: 0 };
    };
    const store = new MacOsKeychainStore(runner);
    await expect(store.get()).resolves.toEqual(tokens);
    await expect(store.delete()).resolves.toBeUndefined();
  });
});
