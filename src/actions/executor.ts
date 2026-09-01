import { ActionStore } from './store.js';
import type { ActionPreview, WriteResult } from './types.js';

interface Writer { execute(action: ActionPreview): Promise<WriteResult> }

export class ActionExecutor {
  constructor(
    private readonly store: ActionStore,
    private readonly getAccountId: () => Promise<string>,
    private readonly writer: Writer
  ) {}

  async execute(actionId: string): Promise<WriteResult & { actionId: string; kind: ActionPreview['kind'] }> {
    const accountId = await this.getAccountId();
    const action = await this.store.consume(actionId, accountId);
    return { ...(await this.writer.execute(action)), actionId, kind: action.kind };
  }
}
