import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { XCliError } from '../errors.js';

interface LockRecord {
  pid: number;
  startedAt: number;
  token: string;
}

interface BrowserLockOptions {
  pid?: number;
  now?: () => number;
  isProcessAlive?: (pid: number) => boolean;
}

export class BrowserLock {
  private readonly pid: number;
  private readonly now: () => number;
  private readonly isProcessAlive: (pid: number) => boolean;

  constructor(private readonly path: string, options: BrowserLockOptions = {}) {
    this.pid = options.pid ?? process.pid;
    this.now = options.now ?? Date.now;
    this.isProcessAlive = options.isProcessAlive ?? processIsAlive;
  }

  async withLock<T>(work: () => Promise<T>): Promise<T> {
    const record: LockRecord = { pid: this.pid, startedAt: this.now(), token: randomUUID() };
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await this.acquire(record);
    try {
      return await work();
    } finally {
      await this.release(record.token);
    }
  }

  private async acquire(record: LockRecord): Promise<void> {
    try {
      await writeFile(this.path, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
      return;
    } catch (error) {
      if (!hasCode(error, 'EEXIST')) throw new XCliError('BROWSER_BUSY', 'Unable to acquire browser command lock', 2);
    }

    const existing = await this.read();
    if (existing !== null && this.isProcessAlive(existing.pid)) {
      throw new XCliError('BROWSER_BUSY', 'Another X-CLI browser command is already running', 2);
    }
    await unlink(this.path).catch((error: unknown) => {
      if (!hasCode(error, 'ENOENT')) throw error;
    });
    try {
      await writeFile(this.path, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
    } catch {
      throw new XCliError('BROWSER_BUSY', 'Another X-CLI browser command acquired the lock', 2);
    }
  }

  private async release(token: string): Promise<void> {
    const existing = await this.read();
    if (existing?.token === token) await unlink(this.path).catch(() => undefined);
  }

  private async read(): Promise<LockRecord | null> {
    try {
      const value = JSON.parse(await readFile(this.path, 'utf8')) as Partial<LockRecord>;
      if (typeof value.pid !== 'number' || typeof value.startedAt !== 'number' || typeof value.token !== 'string') return null;
      return value as LockRecord;
    } catch {
      return null;
    }
  }
}

function processIsAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return hasCode(error, 'EPERM'); }
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
