import { ActionStore } from '../actions/store.js';
import type { ActionPreview, BulkExecutionResult, WriteResult } from '../actions/types.js';
interface Writer {
    validate?(action: ActionPreview): Promise<void>;
    execute(action: ActionPreview): Promise<WriteResult>;
}
export declare class BulkExecutor {
    private readonly store;
    private readonly getAccountId;
    private readonly writer;
    private readonly delay;
    constructor(store: ActionStore, getAccountId: () => Promise<string>, writer: Writer, delay?: (milliseconds: number) => Promise<void>);
    execute(actionId: string): Promise<BulkExecutionResult>;
    private finish;
}
export {};
