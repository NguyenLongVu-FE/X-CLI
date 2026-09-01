import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { classifyStatusObservation } from '../src/browser/client.js';
import { buildXProgram } from '../src/browser/x-program.js';

const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'x');
const fixture = (name: string) => readFile(join(fixtureRoot, name), 'utf8');

describe('X browser status contract', () => {
  it('runs the generated status program in a dedicated page and closes it', async () => {
    const events: string[] = [];
    const logs: string[] = [];
    const snapshotOptions: unknown[] = [];
    const attributeOptions: unknown[] = [];
    const page = {
      goto: async (url: string) => { events.push(`goto:${url}`); },
      url: () => 'https://x.com/home',
      locator: (selector: string) => selector.includes('Profile')
        ? { getAttribute: async (_name: string, options: unknown) => { attributeOptions.push(options); return '/imtamhn'; } }
        : { locator: () => ({ first: () => ({ getAttribute: async (_name: string, options: unknown) => { attributeOptions.push(options); return 'Tam'; } }) }) },
      removeAllListeners: () => { events.push('listeners-removed'); },
      close: async () => { events.push('closed'); }
    };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'status', expectedUsername: 'imtamhn' }));
    await execute(
      { newPage: async () => page }, async () => undefined, async () => [], async (options: unknown) => {
        snapshotOptions.push(options);
        return 'authenticated';
      }, {},
      { log: (value: unknown) => { logs.push(String(value)); } }
    );
    expect(logs.filter((line) => line.startsWith('__XCLI_RESULT__'))).toEqual([
      '__XCLI_RESULT__{"url":"https://x.com/home","profileHref":"/imtamhn","displayName":"Tam","snapshot":"authenticated"}'
    ]);
    expect(snapshotOptions).toEqual([{ page }]);
    expect(attributeOptions).toEqual([{ timeout: 2_000 }, { timeout: 2_000 }]);
    expect(events).toEqual(['goto:https://x.com/home', 'listeners-removed', 'closed']);
  });

  it('accepts the bound account only when the authenticated profile link matches', async () => {
    expect(classifyStatusObservation({
      url: 'https://x.com/home', profileHref: '/imtamhn', displayName: 'Tam', snapshot: await fixture('status-authenticated.txt')
    }, 'imtamhn')).toEqual({ connected: true, authenticated: true, username: 'imtamhn' });
  });

  it('rejects a different authenticated profile before any command can act', async () => {
    const snapshot = await fixture('status-authenticated.txt');
    expect(() => classifyStatusObservation({
      url: 'https://x.com/home', profileHref: '/another_user', displayName: 'Other', snapshot
    }, 'imtamhn')).toThrowError(expect.objectContaining({ code: 'ACCOUNT_MISMATCH' }));
  });

  it('distinguishes logged-out and challenged sessions', async () => {
    const loggedOut = await fixture('status-logged-out.txt');
    const challenged = await fixture('status-challenge.txt');
    expect(() => classifyStatusObservation({
      url: 'https://x.com/', profileHref: null, snapshot: loggedOut
    }, 'imtamhn')).toThrowError(expect.objectContaining({ code: 'LOGIN_REQUIRED' }));
    expect(() => classifyStatusObservation({
      url: 'https://x.com/account/access', profileHref: null, snapshot: challenged
    }, 'imtamhn')).toThrowError(expect.objectContaining({ code: 'CHALLENGE_REQUIRED' }));
  });

  it('reports an X UI change instead of pretending the user logged out', () => {
    expect(() => classifyStatusObservation({
      url: 'https://x.com/home', profileHref: null, snapshot: '- main:\n  - generic "Unknown new layout"'
    }, 'imtamhn')).toThrowError(expect.objectContaining({ code: 'X_UI_CHANGED' }));
  });
});

describe('X browser read program', () => {
  it('selects For You and stops after three scrolls without new canonical posts', async () => {
    const logs: string[] = [];
    const selectedTabs: string[] = [];
    let scrolls = 0;
    const rawPost = { url: '/alice/status/101', text: 'hello', authorUsername: 'alice' };
    const page = {
      goto: async () => undefined,
      url: () => 'https://x.com/home',
      getByRole: (_role: string, options: { name: string }) => {
        selectedTabs.push(options.name);
        return { getAttribute: async () => 'true', click: async () => undefined };
      },
      locator: (selector: string) => {
        if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
        if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
        if (selector.includes('tweet')) return { evaluateAll: async () => [rawPost] };
        throw new Error(`unexpected selector: ${selector}`);
      },
      evaluate: async () => { scrolls += 1; },
      removeAllListeners: () => undefined,
      close: async () => undefined
    };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({
      kind: 'read-feed', feed: 'for-you', limit: 5, expectedUsername: 'imtamhn'
    }));

    await execute(
      { newPage: async () => page }, async () => undefined, async () => [], async () => 'authenticated', {},
      { log: (value: unknown) => { logs.push(String(value)); } }
    );

    const result = JSON.parse(logs.find((line) => line.startsWith('__XCLI_RESULT__'))!.slice('__XCLI_RESULT__'.length));
    expect(result).toMatchObject({ state: 'ok', value: [{ ...rawPost, url: 'https://x.com/alice/status/101' }] });
    expect(result.account.profileHref).toBe('/imtamhn');
    expect(selectedTabs).toContain('For you');
    expect(scrolls).toBe(3);
  });
});
