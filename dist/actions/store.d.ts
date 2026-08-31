import type { ActionPreview } from './types.js';
export declare class ActionStore {
    private readonly root;
    private readonly now;
    constructor(root: string, now?: () => number);
    save(preview: ActionPreview): Promise<void>;
    consume(id: string, accountId: string): Promise<ActionPreview>;
    private path;
}
export declare function hashPreview(preview: Omit<ActionPreview, 'hash'> | ActionPreview): string;
