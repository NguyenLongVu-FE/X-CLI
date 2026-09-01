import { hashPreview } from '../actions/store.js';
import { XCliError } from '../errors.js';
export class BulkExecutor {
    store;
    getAccountId;
    writer;
    delay;
    constructor(store, getAccountId, writer, delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))) {
        this.store = store;
        this.getAccountId = getAccountId;
        this.writer = writer;
        this.delay = delay;
    }
    async execute(actionId) {
        const accountId = await this.getAccountId();
        const preview = await this.store.inspectBulk(actionId, accountId);
        const actions = preview.actions.map((_, index) => childPreview(preview, index));
        for (const action of actions)
            await this.writer.validate?.(action);
        await this.store.consumeBulk(actionId, accountId);
        const results = [];
        for (const [index, action] of actions.entries()) {
            if (index > 0)
                await this.delay(5_000);
            try {
                const written = await this.writer.execute(action);
                results.push({ index, kind: action.kind, outcome: written.outcome });
                if (written.outcome !== 'confirmed')
                    return this.finish(actionId, results, true, 'ACTION_UNKNOWN');
            }
            catch (error) {
                if (!(error instanceof XCliError))
                    throw error;
                results.push({ index, kind: action.kind, outcome: 'unknown', error: error.code });
                return this.finish(actionId, results, true, error.code);
            }
            await this.store.saveBulkResult({ actionId, stopped: false, results: [...results] });
        }
        return this.finish(actionId, results, false);
    }
    async finish(actionId, results, stopped, stopCode) {
        const result = { actionId, stopped, ...(stopCode === undefined ? {} : { stopCode }), results };
        await this.store.saveBulkResult(result);
        return result;
    }
}
function childPreview(bulk, index) {
    const input = bulk.actions[index];
    const unsigned = { ...input, version: 1, id: bulk.id, accountId: bulk.accountId, createdAt: bulk.createdAt, expiresAt: bulk.expiresAt };
    return { ...unsigned, hash: hashPreview(unsigned) };
}
