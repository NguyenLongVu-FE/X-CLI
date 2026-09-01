import { XCliError } from '../errors.js';
import type { BrowserBinding, BrowserBindingStore } from './config.js';
import { normalizeBrowserPost, normalizeBrowserPosts, normalizeBrowserUser } from './normalize.js';
import type { BrowserAccountObservation, BrowserDescriptor, BrowserOperation, BrowserPost, BrowserReadEnvelope, BrowserStatus, BrowserUser } from './types.js';

export type StatusObservation = BrowserAccountObservation;

interface OperationRunner {
  listBrowsers(): Promise<BrowserDescriptor[]>;
  run<T>(operation: BrowserOperation, browserKey: string): Promise<T>;
}

type BindingReader = Pick<BrowserBindingStore, 'get'>;
type ReadInput =
  | { kind: 'read-feed'; feed: 'for-you' | 'following'; limit: number }
  | { kind: 'search-posts'; query: string; limit: number }
  | { kind: 'read-post'; postId: string }
  | { kind: 'read-user'; username: string }
  | { kind: 'check-following'; username: string };

export class BrowserXClient {
  constructor(private readonly runner: OperationRunner, private readonly bindings: BindingReader) {}

  listBrowsers(): Promise<BrowserDescriptor[]> {
    return this.runner.listBrowsers();
  }

  async status(): Promise<BrowserStatus> {
    return (await this.observeStatus()).status;
  }

  async me(): Promise<{ id: string; name: string; username: string }> {
    const observed = await this.observeStatus();
    return {
      id: observed.status.username.toLowerCase(),
      name: observed.observation.displayName?.trim() || observed.status.username,
      username: observed.status.username
    };
  }

  async forYouFeed(limit: number): Promise<BrowserPost[]> {
    return normalizeBrowserPosts(await this.read({ kind: 'read-feed', feed: 'for-you', limit }), limit);
  }

  async followingFeed(limit: number): Promise<BrowserPost[]> {
    return normalizeBrowserPosts(await this.read({ kind: 'read-feed', feed: 'following', limit }), limit);
  }

  homeTimeline(limit: number): Promise<BrowserPost[]> { return this.forYouFeed(limit); }
  followingTimeline(limit: number): Promise<BrowserPost[]> { return this.followingFeed(limit); }

  async searchPosts(query: string, limit: number): Promise<BrowserPost[]> {
    return normalizeBrowserPosts(await this.read({ kind: 'search-posts', query, limit }), limit);
  }

  async getPost(postId: string): Promise<BrowserPost> {
    return normalizeBrowserPost(await this.read({ kind: 'read-post', postId }));
  }

  async getUser(username: string): Promise<BrowserUser> {
    return normalizeBrowserUser(await this.read({ kind: 'read-user', username }));
  }

  async isFollowing(username: string): Promise<{ username: string; userId: string; following: boolean }> {
    const value = await this.read({ kind: 'check-following', username });
    const user = normalizeBrowserUser(value);
    if (typeof value !== 'object' || value === null || !('following' in value) || typeof value.following !== 'boolean') {
      throw new XCliError('X_UI_CHANGED', 'X following state was not visible', 2);
    }
    return { username: user.username, userId: user.id, following: value.following };
  }

  private async observeStatus(): Promise<{ status: BrowserStatus; observation: StatusObservation }> {
    const binding = await this.requiredBinding();
    const observation = await this.runner.run<StatusObservation>(
      { kind: 'status', expectedUsername: binding.expectedUsername },
      binding.browserKey
    );
    return { status: classifyStatusObservation(observation, binding.expectedUsername), observation };
  }

  private async read(operation: ReadInput): Promise<unknown> {
    const binding = await this.requiredBinding();
    const input = { ...operation, expectedUsername: binding.expectedUsername } as BrowserOperation;
    const result = await this.runner.run<BrowserReadEnvelope<unknown>>(input, binding.browserKey);
    if (typeof result !== 'object' || result === null || !('account' in result)) {
      throw new XCliError('X_UI_CHANGED', 'X did not return an account observation', 2);
    }
    classifyStatusObservation(result.account, binding.expectedUsername);
    if (result.state === 'not-found') throw new XCliError('TARGET_NOT_FOUND', 'The requested X resource was not found', 3);
    if (result.state !== 'ok' || result.value === null || result.value === undefined) {
      throw new XCliError('X_UI_CHANGED', 'X returned an unexpected visible page structure', 2);
    }
    return result.value;
  }

  private async requiredBinding(): Promise<BrowserBinding> {
    const binding = await this.bindings.get();
    if (binding === null) {
      throw new XCliError('INVALID_INPUT', 'No Chrome profile is bound; run x browser list and x browser bind first', 2);
    }
    return binding;
  }
}

export function classifyStatusObservation(observation: StatusObservation, expectedUsername: string): BrowserStatus {
  let url: URL;
  try { url = new URL(observation.url); }
  catch { throw new XCliError('BROWSER_DISCONNECTED', 'X returned an invalid page URL', 2); }
  if (!['x.com', 'www.x.com'].includes(url.hostname)) {
    throw new XCliError('BROWSER_DISCONNECTED', 'The selected Chrome profile did not load X', 2);
  }
  if (url.pathname.startsWith('/account/access') || /verify your identity|confirm your account/i.test(observation.snapshot)) {
    throw new XCliError('CHALLENGE_REQUIRED', 'X requires an account challenge to be completed in Chrome', 2);
  }
  if (observation.profileHref === null) {
    if (url.pathname === '/' || /log in|sign in|create account/i.test(observation.snapshot)) {
      throw new XCliError('LOGIN_REQUIRED', 'Log in to X in the bound Chrome profile', 2);
    }
    throw new XCliError('X_UI_CHANGED', 'The authenticated X profile control was not found', 2);
  }
  const username = usernameFromProfileHref(observation.profileHref);
  assertExpectedAccount(username, expectedUsername);
  return { connected: true, authenticated: true, username };
}

export function assertExpectedAccount(actualUsername: string, expectedUsername: string): void {
  if (actualUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
    throw new XCliError('ACCOUNT_MISMATCH', `Bound Chrome profile is @${actualUsername}, expected @${expectedUsername}`, 2);
  }
}

function usernameFromProfileHref(href: string): string {
  try {
    const path = new URL(href, 'https://x.com').pathname;
    const match = path.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
    if (match?.[1] !== undefined) return match[1];
  } catch {}
  throw new XCliError('X_UI_CHANGED', 'The X profile link has an unexpected format', 2);
}
