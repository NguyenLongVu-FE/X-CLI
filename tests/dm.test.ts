import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ActionPreview } from '../src/actions/types.js';
import { BrowserXClient } from '../src/browser/client.js';
import { redactDiagnostic } from '../src/browser/runner.js';
import type { BrowserOperation, BrowserReadEnvelope, BrowserWriteEnvelope } from '../src/browser/types.js';
import { BrowserXWriter } from '../src/browser/writer.js';
import { buildXProgram } from '../src/browser/x-program.js';

const account = { url: 'https://x.com/home', profileHref: '/imtamhn', displayName: 'Tam', snapshot: 'authenticated' };
const binding = { get: async () => ({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:sabrina' }) };
const fixture = (name: string) => readFile(join(process.cwd(), 'tests/fixtures/x', name), 'utf8');

function reader(values: unknown[]) {
  const operations: BrowserOperation[] = [];
  const runner = {
    listBrowsers: async () => [],
    run: async <T>(operation: BrowserOperation): Promise<T> => {
      operations.push(operation);
      return { account, state: 'ok', value: values.shift() } as BrowserReadEnvelope<unknown> as T;
    }
  };
  return { client: new BrowserXClient(runner, binding), operations };
}

describe('X direct messages', () => {
  it('lists conversations without returning message previews', async () => {
    const value = JSON.parse(await fixture('dm-list.txt')) as unknown;
    const { client, operations } = reader([value]);
    await expect(client.listDmConversations(1)).resolves.toEqual([
      { username: 'sabrina', name: 'Sabrina', url: 'https://x.com/messages/123' }
    ]);
    expect(operations).toEqual([{ kind: 'list-dm', limit: 1, expectedUsername: 'imtamhn' }]);
  });

  it('reads only an exactly matched conversation and normalizes messages', async () => {
    const thread = JSON.parse(await fixture('dm-thread.txt')) as unknown;
    const { client, operations } = reader([thread]);
    await expect(client.readDmConversation('sabrina', 2)).resolves.toHaveLength(2);
    expect(operations).toEqual([{ kind: 'read-dm', username: 'sabrina', limit: 2, expectedUsername: 'imtamhn' }]);

    const wrong = reader([{ ...(thread as object), conversationUsername: 'someone_else' }]);
    await expect(wrong.client.readDmConversation('sabrina', 2)).rejects.toMatchObject({ code: 'X_UI_CHANGED' });
  });

  it('maps the browser DM PIN state to a recoverable challenge error', async () => {
    const runner = {
      listBrowsers: async () => [],
      run: async <T>(): Promise<T> => ({ account, state: 'challenge' } as BrowserReadEnvelope<never> as T)
    };
    const client = new BrowserXClient(runner, binding);
    await expect(client.listDmConversations(1)).rejects.toMatchObject({ code: 'CHALLENGE_REQUIRED' });
  });

  it('redacts DM bodies from production diagnostics', async () => {
    expect(redactDiagnostic(await fixture('dm-thread.txt'))).not.toContain('private message text');
  });

  it('sends an approved DM through one browser operation and never retries unknown results', async () => {
    const operations: BrowserOperation[] = [];
    const result: BrowserWriteEnvelope = { account, outcome: 'unknown' };
    const runner = { run: async <T>(operation: BrowserOperation): Promise<T> => { operations.push(operation); return result as T; } };
    const writer = new BrowserXWriter(runner, binding);
    const action: ActionPreview = {
      version: 1, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h',
      kind: 'dm-send', target: { username: 'sabrina', userId: 'sabrina' }, text: 'approved reply'
    };
    await expect(writer.execute(action)).resolves.toEqual({ outcome: 'unknown' });
    expect(operations).toEqual([{ kind: 'write', action }]);
  });

  it('reports the visible DM PIN as a challenge without inspecting the inbox', async () => {
    const logs: string[] = [];
    const page = dmPage({ pinRequired: true });
    await executeProgram(buildXProgram({ kind: 'list-dm', limit: 1, expectedUsername: 'imtamhn' }), page, logs);
    expect(marked(logs)).toMatchObject({ state: 'challenge' });
  });

  it('waits for the redirected DM PIN surface before treating the inbox as empty', async () => {
    const logs: string[] = [];
    const page = dmPage({ pinRequired: true, pinAfterWait: true });
    await executeProgram(buildXProgram({ kind: 'list-dm', limit: 1, expectedUsername: 'imtamhn' }), page, logs);
    expect(marked(logs)).toMatchObject({ state: 'challenge' });
  });

  it('opens the exact recipient, submits once, and confirms the sent text', async () => {
    const logs: string[] = [];
    let submissions = 0;
    let sent = false;
    const page = dmPage({
      conversations: [{ username: 'sabrina', name: 'Sabrina', url: 'https://x.com/messages/123' }],
      messages: () => sent ? [{ senderUsername: 'imtamhn', text: 'approved reply' }] : [],
      onSend: () => { sent = true; submissions += 1; }
    });
    const action: ActionPreview = {
      version: 1, id: 'act_1', accountId: 'imtamhn', createdAt: 1, expiresAt: 2, hash: 'h',
      kind: 'dm-send', target: { username: 'sabrina', userId: 'sabrina' }, text: 'approved reply'
    };
    await executeProgram(buildXProgram({ kind: 'write', action }), page, logs);
    expect(marked(logs)).toMatchObject({ outcome: 'confirmed' });
    expect(submissions).toBe(1);
  });
});

function dmPage(options: {
  pinRequired?: boolean;
  pinAfterWait?: boolean;
  conversations?: unknown[];
  messages?: () => unknown[];
  onSend?: () => void;
}) {
  let waited = false;
  return {
    goto: async () => undefined,
    url: () => 'https://x.com/i/chat',
    locator: (selector: string) => {
      if (selector.includes('Profile')) return { getAttribute: async () => '/imtamhn' };
      if (selector.includes('AccountSwitcher')) return { locator: () => ({ first: () => ({ getAttribute: async () => 'Tam' }) }) };
      if (selector.includes('pin-code-input')) return { count: async () => Number(options.pinRequired === true && (options.pinAfterWait !== true || waited)) };
      if (selector.includes('dm-inbox-panel')) return {
        evaluateAll: async () => options.conversations ?? [],
        nth: () => ({ click: async () => undefined })
      };
      if (selector.includes('dm-conversation-title')) return { first: () => ({ innerText: async () => '@sabrina' }) };
      if (selector.includes('messageEntry')) return { evaluateAll: async () => options.messages?.() ?? [] };
      if (selector.includes('dmComposerTextInput')) return { fill: async () => undefined };
      if (selector.includes('dmComposerSendButton')) return { first: () => ({ click: async () => options.onSend?.() }) };
      throw new Error(`unexpected selector: ${selector}`);
    },
    waitForTimeout: async () => { waited = true; },
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
