import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
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
    if (await this.publish(record)) return;

    const existing = await this.read();
    if (existing === null) throw new XCliError('BROWSER_BUSY', 'The browser command lock is incomplete or unreadable', 2);
    if (existing !== undefined && this.isProcessAlive(existing.pid)) {
      throw new XCliError('BROWSER_BUSY', 'Another X-CLI browser command is already running', 2);
    }
    if (existing !== undefined) {
      await unlink(this.path).catch((error: unknown) => {
        if (!hasCode(error, 'ENOENT')) throw error;
      });
    }
    if (!await this.publish(record)) {
      throw new XCliError('BROWSER_BUSY', 'Another X-CLI browser command acquired the lock', 2);
    }
  }

  private async publish(record: LockRecord): Promise<boolean> {
    const temporary = `${this.path}.${record.pid}.${record.token}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
      try { await link(temporary, this.path); return true; }
      catch (error) {
        if (hasCode(error, 'EEXIST')) return false;
        throw error;
      }
    } catch (error) {
      if (hasCode(error, 'EEXIST')) return false;
      throw new XCliError('BROWSER_BUSY', 'Unable to acquire browser command lock', 2);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private async release(token: string): Promise<void> {
    const existing = await this.read();
    if (existing !== null && existing !== undefined && existing.token === token) await unlink(this.path).catch(() => undefined);
  }

  private async read(): Promise<LockRecord | null | undefined> {
    try {
      const value = JSON.parse(await readFile(this.path, 'utf8')) as Partial<LockRecord>;
      if (typeof value.pid !== 'number' || typeof value.startedAt !== 'number' || typeof value.token !== 'string') return null;
      return value as LockRecord;
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return undefined;
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
