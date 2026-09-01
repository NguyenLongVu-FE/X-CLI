import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { XCliError } from '../errors.js';
import type { ActionPreview, BulkExecutionResult, BulkPreview } from './types.js';

export class ActionStore {
  constructor(private readonly root: string, private readonly now: () => number = Date.now) {}

  async save(preview: ActionPreview): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.path(preview.id), `${JSON.stringify(preview)}\n`, { mode: 0o600, flag: 'wx' });
  }

  async saveBulk(preview: BulkPreview): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.path(preview.id), `${JSON.stringify(preview)}\n`, { mode: 0o600, flag: 'wx' });
  }

  async inspectBulk(id: string, accountId: string): Promise<BulkPreview> {
    const preview = await this.readBulk(id);
    this.validateBulk(preview, accountId);
    return preview;
  }

  async consumeBulk(id: string, accountId: string): Promise<BulkPreview> {
    if (!validId(id)) throw changed();
    const consuming = join(this.root, `${id}.consuming`);
    try { await rename(this.path(id), consuming); }
    catch { throw changed(); }
    let preview: BulkPreview;
    try { preview = JSON.parse(await readFile(consuming, 'utf8')) as BulkPreview; }
    catch { await unlink(consuming).catch(() => {}); throw changed(); }
    await unlink(consuming).catch(() => {});
    this.validateBulk(preview, accountId);
    return preview;
  }

  async saveBulkResult(result: BulkExecutionResult): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const destination = this.resultPath(result.actionId);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(result)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
  }

  async readBulkResult(id: string): Promise<BulkExecutionResult> {
    if (!validId(id)) throw changed();
    try { return JSON.parse(await readFile(this.resultPath(id), 'utf8')) as BulkExecutionResult; }
    catch { throw changed(); }
  }

  async inspect(id: string, accountId: string): Promise<ActionPreview> {
    if (!validId(id)) throw changed();
    let preview: ActionPreview;
    try { preview = JSON.parse(await readFile(this.path(id), 'utf8')) as ActionPreview; }
    catch { throw changed(); }
    this.validate(preview, accountId);
    return preview;
  }

  async consume(id: string, accountId: string): Promise<ActionPreview> {
    if (!validId(id)) throw changed();
    const source = this.path(id);
    const consuming = join(this.root, `${id}.consuming`);
    try { await rename(source, consuming); }
    catch { throw changed(); }
    let preview: ActionPreview;
    try { preview = JSON.parse(await readFile(consuming, 'utf8')) as ActionPreview; }
    catch { await unlink(consuming).catch(() => {}); throw changed(); }
    await unlink(consuming).catch(() => {});
    this.validate(preview, accountId);
    return preview;
  }

  private path(id: string): string { return join(this.root, `${id}.json`); }
  private resultPath(id: string): string { return join(this.root, `${id}.result.json`); }

  private async readBulk(id: string): Promise<BulkPreview> {
    if (!validId(id)) throw changed();
    try { return JSON.parse(await readFile(this.path(id), 'utf8')) as BulkPreview; }
    catch { throw changed(); }
  }

  private validate(preview: ActionPreview, accountId: string): void {
    if (preview.accountId !== accountId || preview.hash !== hashPreview(preview)) throw changed();
    if (preview.expiresAt < this.now()) throw new XCliError('ACTION_EXPIRED', 'Action approval has expired', 2);
  }

  private validateBulk(preview: BulkPreview, accountId: string): void {
    if (preview.kind !== 'bulk' || preview.accountId !== accountId || preview.hash !== hashPreview(preview)) throw changed();
    if (preview.expiresAt < this.now()) throw new XCliError('ACTION_EXPIRED', 'Bulk approval has expired', 2);
  }
}

export function hashPreview(preview: Omit<ActionPreview, 'hash'> | ActionPreview | Omit<BulkPreview, 'hash'> | BulkPreview): string {
  const { hash: _hash, ...unsigned } = preview as ActionPreview | BulkPreview;
  return createHash('sha256').update(stableStringify(unsigned)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function changed(): XCliError { return new XCliError('ACTION_CHANGED', 'Action approval is missing, changed, or already consumed', 2); }
function validId(id: string): boolean { return /^act_[a-f0-9]{32}$/.test(id); }
