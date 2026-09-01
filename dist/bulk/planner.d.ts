import { ActionStore } from '../actions/store.js';
import type { BulkPreview } from '../actions/types.js';
export declare class BulkPlanner {
    private readonly store;
    private readonly now;
    constructor(store: ActionStore, now?: () => number);
    plan(path: string, accountId: string): Promise<BulkPreview>;
    planValue(value: unknown, accountId: string): Promise<BulkPreview>;
    private createPreview;
}
