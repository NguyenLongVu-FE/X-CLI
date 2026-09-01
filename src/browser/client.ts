import { XCliError } from '../errors.js';
import type { BrowserBinding, BrowserBindingStore } from './config.js';
import type { BrowserDescriptor, BrowserOperation, BrowserStatus } from './types.js';

export interface StatusObservation {
  url: string;
  profileHref: string | null;
  displayName?: string | null;
  snapshot: string;
}

interface OperationRunner {
  listBrowsers(): Promise<BrowserDescriptor[]>;
  run<T>(operation: BrowserOperation, browserKey: string): Promise<T>;
}

type BindingReader = Pick<BrowserBindingStore, 'get'>;

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

  private async observeStatus(): Promise<{ status: BrowserStatus; observation: StatusObservation }> {
    const binding = await this.requiredBinding();
    const observation = await this.runner.run<StatusObservation>(
      { kind: 'status', expectedUsername: binding.expectedUsername },
      binding.browserKey
    );
    return { status: classifyStatusObservation(observation, binding.expectedUsername), observation };
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
