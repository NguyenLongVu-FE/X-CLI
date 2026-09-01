import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { XCliError } from '../errors.js';
import { normalizeUsername } from '../identifiers.js';
import type { BrowserDescriptor } from './types.js';

export interface BrowserBinding {
  expectedUsername: string;
  browserKey: string;
}

export function assertSupportedBrowser(browser: BrowserDescriptor): void {
  if (browser.type !== 'extension' || browser.browser !== 'Chrome' || browser.profile === '-' || !browser.key.startsWith('install:Chrome:')) {
    throw new XCliError('INVALID_INPUT', 'X-CLI supports only a local Chrome profile connected through the Playwriter extension', 2);
  }
}

export class BrowserBindingStore {
  constructor(private readonly path: string) {}

  async get(): Promise<BrowserBinding | null> {
    let contents: string;
    try { contents = await readFile(this.path, 'utf8'); }
    catch (error) {
      if (isMissing(error)) return null;
      throw invalidConfig();
    }
    try {
      const parsed = JSON.parse(contents) as Partial<BrowserBinding>;
      if (typeof parsed.expectedUsername !== 'string') throw new Error();
      if (typeof parsed.browserKey !== 'string' || !validBrowserKey(parsed.browserKey)) throw new Error();
      const normalized = normalizeUsername(parsed.expectedUsername);
      if (normalized !== parsed.expectedUsername) throw new Error();
      return { expectedUsername: normalized, browserKey: parsed.browserKey };
    } catch {
      throw invalidConfig();
    }
  }

  async set(binding: BrowserBinding): Promise<void> {
    const normalized = normalizeUsername(binding.expectedUsername);
    if (normalized !== binding.expectedUsername || !validBrowserKey(binding.browserKey)) {
      throw new XCliError('INVALID_INPUT', 'Browser binding is invalid');
    }
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify({ expectedUsername: normalized, browserKey: binding.browserKey })}\n`, { mode: 0o600, flag: 'wx' });
      await rename(temporary, this.path);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function invalidConfig(): XCliError {
  return new XCliError('INVALID_INPUT', 'Browser binding configuration is malformed', 2);
}

function validBrowserKey(value: string): boolean {
  return /^[^\s\u0000-\u001f\u007f]{1,200}$/.test(value);
}
