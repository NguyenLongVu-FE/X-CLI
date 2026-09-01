import { ActionStore } from './store.js';
import type { ActionPreview, WriteResult } from './types.js';
interface Writer {
    execute(action: ActionPreview): Promise<WriteResult>;
}
export declare class ActionExecutor {
    private readonly store;
    private readonly getAccountId;
    private readonly writer;
    constructor(store: ActionStore, getAccountId: () => Promise<string>, writer: Writer);
    execute(actionId: string): Promise<WriteResult & {
        actionId: string;
        kind: ActionPreview['kind'];
    }>;
}
export {};
