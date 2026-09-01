import type { ActionPreview, BulkExecutionResult, BulkPreview } from './types.js';
export declare class ActionStore {
    private readonly root;
    private readonly now;
    constructor(root: string, now?: () => number);
    save(preview: ActionPreview): Promise<void>;
    saveBulk(preview: BulkPreview): Promise<void>;
    inspectBulk(id: string, accountId: string): Promise<BulkPreview>;
    consumeBulk(id: string, accountId: string): Promise<BulkPreview>;
    saveBulkResult(result: BulkExecutionResult): Promise<void>;
    readBulkResult(id: string): Promise<BulkExecutionResult>;
    inspect(id: string, accountId: string): Promise<ActionPreview>;
    consume(id: string, accountId: string): Promise<ActionPreview>;
    private path;
    private resultPath;
    private readBulk;
    private validate;
    private validateBulk;
}
export declare function hashPreview(preview: Omit<ActionPreview, 'hash'> | ActionPreview | Omit<BulkPreview, 'hash'> | BulkPreview): string;
