import { ActionStore, hashPreview } from '../actions/store.js';
import type { ActionPreview, BulkExecutionResult, BulkItemResult, BulkPreview, WriteResult } from '../actions/types.js';
import { XCliError } from '../errors.js';

interface Writer {
  validate?(action: ActionPreview): Promise<void>;
  execute(action: ActionPreview): Promise<WriteResult>;
}

export class BulkExecutor {
  constructor(
    private readonly store: ActionStore,
    private readonly getAccountId: () => Promise<string>,
    private readonly writer: Writer,
    private readonly delay: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  ) {}

  async execute(actionId: string): Promise<BulkExecutionResult> {
    const accountId = await this.getAccountId();
    const preview = await this.store.inspectBulk(actionId, accountId);
    const actions = preview.actions.map((_, index) => childPreview(preview, index));
    for (const action of actions) await this.writer.validate?.(action);
    await this.store.consumeBulk(actionId, accountId);
    const results: BulkItemResult[] = [];
    for (const [index, action] of actions.entries()) {
      if (index > 0) await this.delay(5_000);
      try {
        const written = await this.writer.execute(action);
        results.push({ index, kind: action.kind, outcome: written.outcome });
        if (written.outcome !== 'confirmed') return this.finish(actionId, results, true, 'ACTION_UNKNOWN');
      } catch (error) {
        if (!(error instanceof XCliError)) throw error;
        results.push({ index, kind: action.kind, outcome: 'unknown', error: error.code });
        return this.finish(actionId, results, true, error.code);
      }
      await this.store.saveBulkResult({ actionId, stopped: false, results: [...results] });
    }
    return this.finish(actionId, results, false);
  }

  private async finish(actionId: string, results: BulkItemResult[], stopped: boolean, stopCode?: string): Promise<BulkExecutionResult> {
    const result: BulkExecutionResult = { actionId, stopped, ...(stopCode === undefined ? {} : { stopCode }), results };
    await this.store.saveBulkResult(result);
    return result;
  }
}

function childPreview(bulk: BulkPreview, index: number): ActionPreview {
  const input = bulk.actions[index]!;
  const unsigned = { ...input, version: 1 as const, id: bulk.id, accountId: bulk.accountId, createdAt: bulk.createdAt, expiresAt: bulk.expiresAt };
  return { ...unsigned, hash: hashPreview(unsigned) };
}
