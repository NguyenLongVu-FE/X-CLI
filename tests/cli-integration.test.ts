import { describe, expect, it } from 'vitest';

import { runCommand, type AppDependencies } from '../src/app.js';
import { parseArgs } from '../src/args.js';

function dependencies(): AppDependencies {
  return {
    oauth: { login: async () => ({ authenticated: true }), status: async () => ({ authenticated: true }), logout: async () => {} },
    browser: {
      list: async () => [{ key: 'install:Chrome:sabrina', profile: 'itstamhn@gmail.com' }],
      bind: async (username, browserKey) => ({ expectedUsername: username, browserKey }),
      status: async () => ({ connected: true, authenticated: true, username: 'imtamhn' })
    },
    client: {
      me: async () => ({ id: '1', name: 'Tam', username: 'imtamhn' }),
      forYouFeed: async () => [{ id: '10', text: 'home' }], followingFeed: async () => [{ id: '11', text: 'following' }],
      homeTimeline: async () => [{ id: '10', text: 'home' }], followingTimeline: async () => [{ id: '11', text: 'following' }],
      searchPosts: async () => [{ id: '12', text: 'search' }], getPost: async (id) => ({ id, text: 'post' }),
      getUser: async (username) => ({ id: '2', name: 'User', username }),
      isFollowing: async (username) => ({ username, userId: '2', following: false }),
      bookmarks: async () => [{ id: '42', text: 'saved' }],
      listDmConversations: async () => [{ username: 'sabrina', name: 'Sabrina', url: 'https://x.com/messages/123' }],
      readDmConversation: async (username) => [{ conversationUsername: username, senderUsername: username, text: 'private' }]
    },
    planner: { plan: async (input, accountId) => ({ ...input, version: 1 as const, id: 'act_1', accountId, createdAt: 1, expiresAt: 2, hash: 'h' }) },
    executor: { execute: async (id) => ({ actionId: id, kind: 'like' as const, outcome: 'confirmed' as const }) },
    bulkPlanner: { plan: async (path, accountId) => ({ version: 1 as const, id: 'act_bulk', accountId, kind: 'bulk' as const, sourceHash: path, actions: [], createdAt: 1, expiresAt: 2, hash: 'h' }) },
    bulkExecutor: { execute: async (id) => ({ actionId: id, stopped: false, results: [] }) }
  };
}

describe('complete CLI wiring', () => {
  it('returns singular reads as JSON and timelines as NDJSON', async () => {
    expect(await runCommand(parseArgs(['me']), dependencies())).toBe('{"id":"1","name":"Tam","username":"imtamhn"}\n');
    expect(await runCommand(parseArgs(['timeline', 'home', '--limit', '5']), dependencies())).toBe('{"id":"10","text":"home"}\n');
    expect(await runCommand(parseArgs(['feed', 'for-you', '--limit', '5']), dependencies())).toBe(await runCommand(parseArgs(['timeline', 'home', '--limit', '5']), dependencies()));
    expect(await runCommand(parseArgs(['feed', 'following', '--limit', '5']), dependencies())).toBe(await runCommand(parseArgs(['timeline', 'following', '--limit', '5']), dependencies()));
    expect(await runCommand(parseArgs(['search', 'posts', 'AI']), dependencies())).toContain('"search"');
    expect(await runCommand(parseArgs(['post', 'get', '10']), dependencies())).toContain('"id":"10"');
    expect(await runCommand(parseArgs(['user', 'get', '@tam']), dependencies())).toContain('"username":"tam"');
    expect(await runCommand(parseArgs(['following', 'check', '@tam']), dependencies())).toContain('"following":false');
  });

  it('creates previews for every write command without executing them', async () => {
    const deps = dependencies(); let executions = 0;
    deps.executor.execute = async () => { executions += 1; throw new Error('must not execute'); };
    for (const argv of [
      ['post', 'create', '--text', 'hello'], ['post', 'delete', '10'], ['reply', '10', '--text', 'thanks'], ['like', '10'], ['unlike', '10'],
      ['follow', '@tam'], ['unfollow', '@tam'], ['bookmark', 'add', '10'], ['bookmark', 'remove', '10'],
      ['dm', 'send', '@sabrina', '--text', 'approved']
    ]) expect(await runCommand(parseArgs(argv), deps)).toContain('"id":"act_1"');
    expect(executions).toBe(0);
  });

  it('returns bookmarks as NDJSON', async () => {
    expect(await runCommand(parseArgs(['bookmark', 'list', '--limit', '1']), dependencies())).toBe('{"id":"42","text":"saved"}\n');
  });

  it('returns DM list/read as NDJSON without sending', async () => {
    expect(await runCommand(parseArgs(['dm', 'list', '--limit', '1']), dependencies())).toContain('"username":"sabrina"');
    expect(await runCommand(parseArgs(['dm', 'read', '@sabrina', '--limit', '1']), dependencies())).toContain('"text":"private"');
  });

  it('executes only an explicit action command and supports auth commands', async () => {
    const deps = dependencies();
    expect(await runCommand(parseArgs(['action', 'execute', 'act_123']), deps)).toContain('"outcome":"confirmed"');
    expect(await runCommand(parseArgs(['auth', 'status']), deps)).toContain('"authenticated":true');
    expect(await runCommand(parseArgs(['auth', 'logout']), deps)).toBe('{"authenticated":false}\n');
  });

  it('previews and executes bulk only through explicit commands', async () => {
    const deps = dependencies();
    expect(await runCommand(parseArgs(['bulk', 'plan', '--input', './actions.json']), deps)).toContain('"kind":"bulk"');
    expect(await runCommand(parseArgs(['bulk', 'execute', 'act_123']), deps)).toContain('"stopped":false');
  });

  it('lists, binds, and verifies an explicit Playwriter browser', async () => {
    const deps = dependencies();
    expect(await runCommand(parseArgs(['browser', 'list']), deps)).toContain('"key":"install:Chrome:sabrina"');
    expect(await runCommand(parseArgs(['browser', 'bind', '@imtamhn', '--browser', 'install:Chrome:sabrina']), deps)).toContain('"expectedUsername":"imtamhn"');
    expect(await runCommand(parseArgs(['browser', 'status']), deps)).toContain('"authenticated":true');
  });

  it('pretty-prints only when requested', async () => {
    expect(await runCommand(parseArgs(['me', '--pretty']), dependencies())).toContain('\n  "id": "1"');
  });
});
