import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ParsedCommand } from './args.js';
import { ActionExecutor } from './actions/executor.js';
import { ActionPlanner } from './actions/planner.js';
import { ActionStore } from './actions/store.js';
import type { ActionInput, ActionPreview, WriteResult } from './actions/types.js';
import { MacOsKeychainStore } from './auth/keychain.js';
import { createOAuthClient } from './auth/oauth.js';
import { BrowserXClient } from './browser/client.js';
import { BrowserBindingStore } from './browser/config.js';
import { PlaywriterRunner } from './browser/runner.js';
import type { BrowserDescriptor, BrowserStatus } from './browser/types.js';
import { BrowserXWriter } from './browser/writer.js';
import { XCliError } from './errors.js';

interface OAuthCommands {
  login(): Promise<unknown>;
  status(): Promise<unknown>;
  logout(): Promise<void>;
}
interface BrowserCommands {
  list(): Promise<BrowserDescriptor[]>;
  bind(username: string, browserKey: string): Promise<{ expectedUsername: string; browserKey: string }>;
  status(): Promise<BrowserStatus>;
}
interface ReadCommands {
  me(): Promise<{ id: string; name: string; username: string }>;
  forYouFeed(limit: number): Promise<unknown[]>;
  followingFeed(limit: number): Promise<unknown[]>;
  homeTimeline(limit: number): Promise<unknown[]>;
  followingTimeline(limit: number): Promise<unknown[]>;
  searchPosts(query: string, limit: number): Promise<unknown[]>;
  getPost(id: string): Promise<unknown>;
  getUser(username: string): Promise<{ id: string; name: string; username: string }>;
  isFollowing(username: string): Promise<{ username: string; userId: string; following: boolean }>;
}
interface Planner { plan(input: ActionInput, accountId: string): Promise<ActionPreview> }
interface Executor { execute(id: string): Promise<WriteResult & { actionId: string; kind: ActionPreview['kind'] }> }

export interface AppDependencies { oauth: OAuthCommands; browser: BrowserCommands; client: ReadCommands; planner: Planner; executor: Executor }

export async function runCommand(command: ParsedCommand, dependencies: AppDependencies): Promise<string> {
  let value: unknown;
  let collection = false;
  switch (command.kind) {
    case 'auth-login': value = await dependencies.oauth.login(); break;
    case 'auth-status': value = await dependencies.oauth.status(); break;
    case 'auth-logout': await dependencies.oauth.logout(); value = { authenticated: false }; break;
    case 'browser-list': value = await dependencies.browser.list(); collection = true; break;
    case 'browser-bind': value = await dependencies.browser.bind(command.username, command.browserKey); break;
    case 'browser-status': value = await dependencies.browser.status(); break;
    case 'me': value = await dependencies.client.me(); break;
    case 'feed-for-you': value = await dependencies.client.forYouFeed(command.limit); collection = true; break;
    case 'feed-following': value = await dependencies.client.followingFeed(command.limit); collection = true; break;
    case 'timeline-home': value = await dependencies.client.homeTimeline(command.limit); collection = true; break;
    case 'timeline-following': value = await dependencies.client.followingTimeline(command.limit); collection = true; break;
    case 'search-posts': value = await dependencies.client.searchPosts(command.query, command.limit); collection = true; break;
    case 'post-get': value = await dependencies.client.getPost(command.postId); break;
    case 'post-delete': value = await plan(dependencies, { kind: 'post-delete', target: { postId: command.postId } }); break;
    case 'user-get': value = await dependencies.client.getUser(command.username); break;
    case 'following-check': value = await dependencies.client.isFollowing(command.username); break;
    case 'post-create': value = await plan(dependencies, { kind: 'post-create', target: {}, text: command.text }); break;
    case 'reply': value = await plan(dependencies, { kind: 'reply', target: { postId: command.postId }, text: command.text }); break;
    case 'like': value = await plan(dependencies, { kind: 'like', target: { postId: command.postId } }); break;
    case 'unlike': value = await plan(dependencies, { kind: 'unlike', target: { postId: command.postId } }); break;
    case 'follow':
    case 'unfollow': {
      const target = await dependencies.client.getUser(command.username);
      value = await plan(dependencies, { kind: command.kind, target: { username: target.username, userId: target.id } });
      break;
    }
    case 'action-execute': value = await dependencies.executor.execute(command.actionId); break;
  }
  if (command.pretty) return `${JSON.stringify(value, null, 2)}\n`;
  if (collection) return (value as unknown[]).map((entry) => JSON.stringify(entry)).join('\n') + ((value as unknown[]).length ? '\n' : '');
  return `${JSON.stringify(value)}\n`;
}

async function plan(dependencies: AppDependencies, input: ActionInput): Promise<ActionPreview> {
  const account = await dependencies.client.me();
  return dependencies.planner.plan(input, account.id);
}

export function createProductionApp(clientId: string): AppDependencies {
  const credentials = new MacOsKeychainStore();
  const oauth = createOAuthClient(clientId, credentials);
  const supportRoot = join(homedir(), 'Library', 'Application Support', 'x-cli');
  const bindings = new BrowserBindingStore(join(supportRoot, 'browser.json'));
  const runner = new PlaywriterRunner();
  const client = new BrowserXClient(runner, bindings);
  const writer = new BrowserXWriter(runner, bindings);
  const store = new ActionStore(join(supportRoot, 'actions'));
  return {
    oauth,
    browser: {
      list: () => client.listBrowsers(),
      bind: async (expectedUsername, browserKey) => {
        const available = await client.listBrowsers();
        if (!available.some((browser) => browser.key === browserKey)) {
          throw new XCliError('BROWSER_DISCONNECTED', 'The selected Playwriter browser key is not available', 2);
        }
        const binding = { expectedUsername, browserKey };
        await bindings.set(binding);
        return binding;
      },
      status: () => client.status()
    },
    client,
    planner: new ActionPlanner(store),
    executor: new ActionExecutor(store, async () => (await client.me()).id, writer)
  };
}
