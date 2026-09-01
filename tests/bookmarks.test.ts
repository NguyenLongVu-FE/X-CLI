import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ActionPreview } from '../src/actions/types.js';
import { BrowserXClient } from '../src/browser/client.js';
import type { BrowserOperation, BrowserReadEnvelope, BrowserWriteEnvelope } from '../src/browser/types.js';
import { BrowserXWriter } from '../src/browser/writer.js';
import { buildXProgram } from '../src/browser/x-program.js';

const account = { url: 'https://x.com/home', profileHref: '/imtamhn', displayName: 'Tam', snapshot: 'authenticated' };
const binding = { get: async () => ({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:sabrina' }) };

describe('X bookmarks', () => {
  it('reads and normalizes the visible bookmark collection', async () => {
    const fixture = JSON.parse(await readFile(join(process.cwd(), 'tests/fixtures/x/bookmarks.txt'), 'utf8')) as unknown[];
    const operations: BrowserOperation[] = [];
    const runner = {
      listBrowsers: async () => [],
      run: async <T>(operation: BrowserOperation): Promise<T> => {
        operations.push(operation);
        return { account, state: 'ok', value: fixture } as BrowserReadEnvelope<unknown[]> as T;
      }
    };
    const client = new BrowserXClient(runner, binding);

    await expect(client.bookmarks(1)).resolves.toEqual([
      { id: '42', url: 'https://x.com/alice/status/42', text: 'Saved post', authorUsername: 'alice' }
    ]);
    expect(operations).toEqual([{ kind: 'read-bookmarks', limit: 1, expectedUsername: 'imtamhn' }]);
  });

  it('executes bookmark add/remove once and preserves unknown results without retry', async () => {
    const operations: BrowserOperation[] = [];
    const results: BrowserWriteEnvelope[] = [
      { account, outcome: 'confirmed' }, { account, outcome: 'unknown' }
    ];
    const runner = { run: async <T>(operation: BrowserOperation): Promise<T> => { operations.push(operation); return results.shift() as T; } };
    const writer = new BrowserXWriter(runner, binding);
    const base = { version: 1 as const, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', target: { postId: '42' } };
    const add: ActionPreview = { ...base, kind: 'bookmark-add' };
    const remove: ActionPreview = { ...base, kind: 'bookmark-remove' };

    await expect(writer.execute(add)).resolves.toEqual({ outcome: 'confirmed' });
    await expect(writer.execute(remove)).resolves.toEqual({ outcome: 'unknown' });
    expect(operations).toEqual([{ kind: 'write', action: add }, { kind: 'write', action: remove }]);
  });

  it('navigates to the bookmark surface and extracts visible posts', async () => {
    const gotos: string[] = [];
    const logs: string[] = [];
    const page = fakePage({ gotos, onTweets: () => [{ url: '/alice/status/42', text: 'Saved post', authorUsername: 'alice' }] });
    await executeProgram(buildXProgram({ kind: 'read-bookmarks', limit: 1, expectedUsername: 'imtamhn' }), page, logs);
    const result = marked(logs);
    expect(gotos).toContain('https://x.com/i/bookmarks');
    expect(result).toMatchObject({ state: 'ok', value: [{ url: 'https://x.com/alice/status/42' }] });
  });

  it('clicks bookmark once and confirms the removeBookmark toggle', async () => {
    const logs: string[] = [];
    let saved = false;
    let clicks = 0;
    const article = {
      count: async () => 1,
      locator: (selector: string) => ({
        count: async () => selector.includes('removeBookmark') ? Number(saved) : Number(!saved),
        click: async () => { saved = true; clicks += 1; }
      })
    };
    const page = fakePage({
      gotos: [], article,
      onTweets: () => []
    });
    const action: ActionPreview = { version: 1, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h', kind: 'bookmark-add', target: { postId: '42' } };
    await executeProgram(buildXProgram({ kind: 'write', action }), page, logs);
    expect(marked(logs)).toMatchObject({ outcome: 'confirmed' });
    expect(clicks).toBe(1);
  });
});

function fakePage(options: { gotos: string[]; onTweets: () => unknown[]; article?: unknown }) {
  return {
    goto: async (url: string) => { options.gotos.push(url); },
    url: () => 'https://x.com/home',
    locator: (selector: string) => {
      if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
      if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
      if (selector === '[data-testid="tweet"]' && options.article !== undefined) return { filter: () => ({ first: () => options.article }) };
      if (selector === '[data-testid="tweet"]') return {
        first: () => ({ waitFor: async () => undefined }),
        evaluateAll: async () => options.onTweets()
      };
      if (selector.includes('/status/42')) return {};
      throw new Error(`unexpected selector: ${selector}`);
    },
    evaluate: async () => undefined,
    waitForTimeout: async () => undefined,
    removeAllListeners: () => undefined,
    close: async () => undefined
  };
}

async function executeProgram(program: string, page: unknown, logs: string[]): Promise<void> {
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
  const execute = new AsyncFunction('context', 'waitForPageLoad', 'getLatestLogs', 'snapshot', 'state', 'console', program);
  await execute(
    { newPage: async () => page }, async () => undefined, async () => [], async () => 'authenticated', {},
    { log: (value: unknown) => { logs.push(String(value)); } }
  );
}

function marked(logs: string[]): Record<string, unknown> {
  const line = logs.find((entry) => entry.startsWith('__XCLI_RESULT__'))!;
  return JSON.parse(line.slice('__XCLI_RESULT__'.length)) as Record<string, unknown>;
}
