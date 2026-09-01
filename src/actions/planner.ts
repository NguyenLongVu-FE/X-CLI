import { randomUUID } from 'node:crypto';

import { ActionStore, hashPreview } from './store.js';
import type { ActionInput, ActionPreview } from './types.js';

export class ActionPlanner {
  constructor(private readonly store: ActionStore, private readonly now: () => number = Date.now) {}

  async plan(input: ActionInput, accountId: string): Promise<ActionPreview> {
    const createdAt = this.now();
    const unsigned = {
      version: 1 as const,
      id: `act_${randomUUID().replaceAll('-', '').slice(0, 32)}`,
      accountId,
      kind: input.kind,
      target: input.target,
      ...(input.text === undefined ? {} : { text: input.text }),
      ...(input.media === undefined ? {} : { media: input.media }),
      createdAt,
      expiresAt: createdAt + 300_000
    };
    const preview: ActionPreview = { ...unsigned, hash: hashPreview(unsigned as Omit<ActionPreview, 'hash'>) };
    await this.store.save(preview);
    return preview;
  }
}
