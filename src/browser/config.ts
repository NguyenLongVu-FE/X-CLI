import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { XCliError } from '../errors.js';
import { normalizeUsername } from '../identifiers.js';

interface BrowserConfig { expectedUsername: string }

export class BrowserBindingStore {
  constructor(private readonly path: string) {}

  async get(): Promise<string | null> {
    let contents: string;
    try { contents = await readFile(this.path, 'utf8'); }
    catch (error) {
      if (isMissing(error)) return null;
      throw invalidConfig();
    }
    try {
      const parsed = JSON.parse(contents) as Partial<BrowserConfig>;
      if (typeof parsed.expectedUsername !== 'string') throw new Error();
      const normalized = normalizeUsername(parsed.expectedUsername);
      if (normalized !== parsed.expectedUsername) throw new Error();
      return normalized;
    } catch {
      throw invalidConfig();
    }
  }

  async set(username: string): Promise<void> {
    const normalized = normalizeUsername(username);
    if (normalized !== username) throw new XCliError('INVALID_INPUT', `Invalid X username: ${username}`);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify({ expectedUsername: normalized })}\n`, { mode: 0o600, flag: 'wx' });
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
