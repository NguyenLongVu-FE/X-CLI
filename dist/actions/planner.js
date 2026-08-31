import { randomUUID } from 'node:crypto';
import { hashPreview } from './store.js';
export class ActionPlanner {
    store;
    now;
    constructor(store, now = Date.now) {
        this.store = store;
        this.now = now;
    }
    async plan(input, accountId) {
        const createdAt = this.now();
        const unsigned = {
            version: 1,
            id: `act_${randomUUID().replaceAll('-', '').slice(0, 32)}`,
            accountId,
            kind: input.kind,
            target: input.target,
            ...(input.text === undefined ? {} : { text: input.text }),
            createdAt,
            expiresAt: createdAt + 300_000
        };
        const preview = { ...unsigned, hash: hashPreview(unsigned) };
        await this.store.save(preview);
        return preview;
    }
}
