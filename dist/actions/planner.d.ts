import { ActionStore } from './store.js';
import type { ActionInput, ActionPreview } from './types.js';
export declare class ActionPlanner {
    private readonly store;
    private readonly now;
    constructor(store: ActionStore, now?: () => number);
    plan(input: ActionInput, accountId: string): Promise<ActionPreview>;
}
