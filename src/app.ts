import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ParsedCommand } from './args.js';
import { ActionExecutor } from './actions/executor.js';
import { ActionPlanner } from './actions/planner.js';
import { ActionStore } from './actions/store.js';
import type { ActionInput, ActionPreview } from './actions/types.js';
import { XClient } from './api/reads.js';
import { XTransport } from './api/transport.js';
import { XWrites, type WriteResult } from './api/writes.js';
import { MacOsKeychainStore } from './auth/keychain.js';
import { createOAuthClient } from './auth/oauth.js';

interface OAuthCommands {
  login(): Promise<unknown>;
  status(): Promise<unknown>;
  logout(): Promise<void>;
}
interface ReadCommands {
  me(): Promise<{ id: string; name: string; username: string }>;
  homeTimeline(limit: number): Promise<unknown[]>;
  followingTimeline(limit: number): Promise<unknown[]>;
  searchPosts(query: string, limit: number): Promise<unknown[]>;
  getPost(id: string): Promise<unknown>;
  getUser(username: string): Promise<{ id: string; name: string; username: string }>;
}
interface Planner { plan(input: ActionInput, accountId: string): Promise<ActionPreview> }
interface Executor { execute(id: string): Promise<WriteResult & { actionId: string; kind: ActionPreview['kind'] }> }

export interface AppDependencies { oauth: OAuthCommands; client: ReadCommands; planner: Planner; executor: Executor }

export async function runCommand(command: ParsedCommand, dependencies: AppDependencies): Promise<string> {
  let value: unknown;
  let collection = false;
  switch (command.kind) {
    case 'auth-login': value = await dependencies.oauth.login(); break;
    case 'auth-status': value = await dependencies.oauth.status(); break;
    case 'auth-logout': await dependencies.oauth.logout(); value = { authenticated: false }; break;
    case 'me': value = await dependencies.client.me(); break;
    case 'timeline-home': value = await dependencies.client.homeTimeline(command.limit); collection = true; break;
    case 'timeline-following': value = await dependencies.client.followingTimeline(command.limit); collection = true; break;
    case 'search-posts': value = await dependencies.client.searchPosts(command.query, command.limit); collection = true; break;
    case 'post-get': value = await dependencies.client.getPost(command.postId); break;
    case 'user-get': value = await dependencies.client.getUser(command.username); break;
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
  const transport = new XTransport({ store: credentials, refresh: () => oauth.refresh(), fetch: globalThis.fetch });
  const client = new XClient(transport);
  const store = new ActionStore(join(homedir(), 'Library', 'Application Support', 'x-cli', 'actions'));
  return {
    oauth,
    client,
    planner: new ActionPlanner(store),
    executor: new ActionExecutor(store, async () => (await client.me()).id, new XWrites(transport))
  };
}
