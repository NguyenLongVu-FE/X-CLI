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
    expect(snapshotOptions).toEqual([]);
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
  it('recognizes the live unfollow control as an already-following relationship', () => {
    const program = buildXProgram({ kind: 'check-following', username: 'XDevelopers', expectedUsername: 'imtamhn' });
    expect(program).toContain('[data-testid$="-unfollow"]');
  });

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

describe('X browser write program', () => {
  it('never clicks a recommendation follow button when the exact target profile is absent', async () => {
    const logs: string[] = [];
    let recommendationClicks = 0;
    const recommendation = { first: () => ({ innerText: async () => 'Follow', click: async () => { recommendationClicks += 1; } }) };
    const page = {
      goto: async () => undefined,
      url: () => 'https://x.com/suspended',
      locator: (selector: string) => {
        if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
        if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
        if (selector.includes('UserName')) return { first: () => ({ innerText: async () => null }) };
        if (selector.includes('-follow')) return recommendation;
        throw new Error(`unexpected selector: ${selector}`);
      },
      removeAllListeners: () => undefined,
      close: async () => undefined
    };
    const action = {
      version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h',
      kind: 'follow' as const, target: { username: 'sabrina', userId: 'sabrina' }
    };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'write', action }));
    await execute(
      { newPage: async () => page }, async () => undefined, async () => [], async () => 'This page doesn’t exist', {},
      { log: (value: unknown) => { logs.push(String(value)); } }
    );
    const result = JSON.parse(logs.find((line) => line.startsWith('__XCLI_RESULT__'))!.slice('__XCLI_RESULT__'.length));
    expect(result).toMatchObject({ failure: 'target-not-found' });
    expect(recommendationClicks).toBe(0);
  });

  it('uploads approved media once before one post submission', async () => {
    const logs: string[] = [];
    const uploads: string[][] = [];
    let submissions = 0;
    let submitted = false;
    const page = {
      goto: async () => undefined,
      url: () => 'https://x.com/home',
      locator: (selector: string) => {
        if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
        if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
        if (selector.includes('tweetTextarea')) return { fill: async () => undefined };
        if (selector === 'input[type="file"]') return { first: () => ({ setInputFiles: async (paths: string[]) => { uploads.push(paths); } }) };
        if (selector.includes('attachments')) return { count: async () => 1 };
        if (selector.includes('tweetButton')) return { first: () => ({ click: async () => { submissions += 1; submitted = true; } }) };
        if (selector === '[data-testid="tweet"]') return { evaluateAll: async () => submitted ? [{ url: '/imtamhn/status/99', text: 'Photo', authorUsername: 'imtamhn', createdAt: new Date().toISOString() }] : [] };
        throw new Error(`unexpected selector: ${selector}`);
      },
      waitForTimeout: async () => undefined,
      removeAllListeners: () => undefined,
      close: async () => undefined
    };
    const action = {
      version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', kind: 'post-create' as const,
      target: {}, text: 'Photo', media: [{ path: '/tmp/photo.png', size: 3, sha256: 'abc' }]
    };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'write', action }));
    await execute(
      { newPage: async () => page }, async () => undefined, async () => [], async () => 'authenticated', {},
      { log: (value: unknown) => { logs.push(String(value)); } }
    );

    const result = JSON.parse(logs.find((line) => line.startsWith('__XCLI_RESULT__'))!.slice('__XCLI_RESULT__'.length));
    expect(result).toMatchObject({ outcome: 'confirmed', resourceId: '99' });
    expect(uploads).toEqual([['/tmp/photo.png']]);
    expect(submissions).toBe(1);
  });

  it('does not confirm a post submission from an unchanged identical old post', async () => {
    const logs: string[] = [];
    const old = { url: '/imtamhn/status/50', text: 'Same text', authorUsername: 'imtamhn' };
    const page = {
      goto: async () => undefined,
      url: () => 'https://x.com/home',
      locator: (selector: string) => {
        if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
        if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
        if (selector.includes('tweetTextarea')) return { fill: async () => undefined };
        if (selector.includes('tweetButton')) return { first: () => ({ click: async () => undefined }) };
        if (selector === '[data-testid="tweet"]') return { evaluateAll: async () => [old] };
        throw new Error(`unexpected selector: ${selector}`);
      },
      waitForTimeout: async () => undefined,
      removeAllListeners: () => undefined,
      close: async () => undefined
    };
    const action = { version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', kind: 'post-create' as const, target: {}, text: 'Same text' };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'write', action }));
    await execute({ newPage: async () => page }, async () => undefined, async () => [], async () => 'authenticated', {}, { log: (value: unknown) => { logs.push(String(value)); } });
    const result = JSON.parse(logs.find((line) => line.startsWith('__XCLI_RESULT__'))!.slice('__XCLI_RESULT__'.length));
    expect(result).toMatchObject({ outcome: 'unknown' });
  });

  it('does not confirm an old identical post that appears only after submission', async () => {
    const logs: string[] = [];
    let submitted = false;
    const old = { url: '/imtamhn/status/50', text: 'Same text', authorUsername: 'imtamhn', createdAt: '2020-01-01T00:00:00.000Z' };
    const page = {
      goto: async () => undefined,
      url: () => 'https://x.com/home',
      locator: (selector: string) => {
        if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
        if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
        if (selector.includes('tweetTextarea')) return { fill: async () => undefined };
        if (selector.includes('tweetButton')) return { first: () => ({ click: async () => { submitted = true; } }) };
        if (selector === '[data-testid="tweet"]') return { evaluateAll: async () => submitted ? [old] : [] };
        throw new Error(`unexpected selector: ${selector}`);
      },
      waitForTimeout: async () => undefined,
      removeAllListeners: () => undefined,
      close: async () => undefined
    };
    const action = { version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', kind: 'post-create' as const, target: {}, text: 'Same text' };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'write', action }));
    await execute({ newPage: async () => page }, async () => undefined, async () => [], async () => 'authenticated', {}, { log: (value: unknown) => { logs.push(String(value)); } });
    expect(markedWrite(logs)).toMatchObject({ outcome: 'unknown' });
  });

  it('classifies a composer failure before submission as UI drift', async () => {
    const logs: string[] = [];
    const page = postFailurePage({ fillFails: true });
    await executeWriteProgram(page, logs);
    expect(markedWrite(logs)).toMatchObject({ failure: 'ui-changed' });
  });

  it('keeps a submission exception unknown after the mutating click starts', async () => {
    const logs: string[] = [];
    const page = postFailurePage({ clickFails: true });
    await executeWriteProgram(page, logs);
    expect(markedWrite(logs)).toMatchObject({ outcome: 'unknown' });
  });

  it('stops before target navigation when the authenticated account is absent', async () => {
    const logs: string[] = [];
    const gotos: string[] = [];
    const page = {
      goto: async (url: string) => { gotos.push(url); },
      url: () => 'https://x.com/',
      locator: (selector: string) => {
        if (selector.includes('Profile')) return { getAttribute: async () => null };
        if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => null }) }) };
        throw new Error('write target must not be inspected');
      },
      removeAllListeners: () => undefined,
      close: async () => undefined
    };
    const action = { version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', kind: 'like' as const, target: { postId: '10' } };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'write', action }));

    await execute(
      { newPage: async () => page }, async () => undefined, async () => [], async () => 'Log in', {},
      { log: (value: unknown) => { logs.push(String(value)); } }
    );

    const result = JSON.parse(logs.find((line) => line.startsWith('__XCLI_RESULT__'))!.slice('__XCLI_RESULT__'.length));
    expect(result).toMatchObject({ outcome: 'unknown', account: { profileHref: null } });
    expect(gotos).toEqual(['https://x.com/home']);
  });

  it('performs one like click and confirms the visible toggle change', async () => {
    const logs: string[] = [];
    let liked = false;
    let clicks = 0;
    const article = {
      count: async () => 1,
      locator: (selector: string) => ({
        count: async () => selector.includes('unlike') ? Number(liked) : Number(!liked),
        click: async () => { clicks += 1; liked = true; }
      })
    };
    const page = {
      goto: async () => undefined,
      url: () => 'https://x.com/imtamhn/status/10',
      locator: (selector: string) => {
        if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
        if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
        if (selector === '[data-testid="tweet"]') return { filter: () => ({ first: () => article }) };
        if (selector.includes('/status/10')) return {};
        throw new Error(`unexpected selector: ${selector}`);
      },
      waitForTimeout: async () => undefined,
      removeAllListeners: () => undefined,
      close: async () => undefined
    };
    const action = { version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', kind: 'like' as const, target: { postId: '10' } };
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'write', action }));

    await execute(
      { newPage: async () => page }, async () => undefined, async () => [], async () => 'authenticated', {},
      { log: (value: unknown) => { logs.push(String(value)); } }
    );

    const result = JSON.parse(logs.find((line) => line.startsWith('__XCLI_RESULT__'))!.slice('__XCLI_RESULT__'.length));
    expect(result).toMatchObject({ outcome: 'confirmed' });
    expect(clicks).toBe(1);
  });
});

function postFailurePage(options: { fillFails?: boolean; clickFails?: boolean }) {
  return {
    goto: async () => undefined,
    url: () => 'https://x.com/compose/post',
    locator: (selector: string) => {
      if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
      if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
      if (selector === '[data-testid="tweet"]') return { evaluateAll: async () => [] };
      if (selector.includes('tweetTextarea')) return { fill: async () => { if (options.fillFails) throw new Error('selector changed'); } };
      if (selector.includes('tweetButton')) return { first: () => ({ click: async () => { if (options.clickFails) throw new Error('connection lost'); } }) };
      throw new Error(`unexpected selector: ${selector}`);
    },
    removeAllListeners: () => undefined,
    close: async () => undefined
  };
}

async function executeWriteProgram(page: unknown, logs: string[]) {
  const action = { version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', kind: 'post-create' as const, target: {}, text: 'hello' };
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
  const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', buildXProgram({ kind: 'write', action }));
  await execute({ newPage: async () => page }, async () => undefined, async () => [], async () => 'authenticated', {}, { log: (value: unknown) => { logs.push(String(value)); } });
}

function markedWrite(logs: string[]) {
  const line = logs.find((entry) => entry.startsWith('__XCLI_RESULT__'))!;
  return JSON.parse(line.slice('__XCLI_RESULT__'.length)) as Record<string, unknown>;
}
