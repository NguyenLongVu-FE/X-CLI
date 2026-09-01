import type { ActionPreview, WriteResult } from '../actions/types.js';
import type { BrowserBindingStore } from './config.js';
import type { BrowserOperation } from './types.js';
interface OperationRunner {
    run<T>(operation: BrowserOperation, browserKey: string): Promise<T>;
}
type BindingReader = Pick<BrowserBindingStore, 'get'>;
export declare class BrowserXWriter {
    private readonly runner;
    private readonly bindings;
    constructor(runner: OperationRunner, bindings: BindingReader);
    validate(action: ActionPreview): Promise<void>;
    execute(action: ActionPreview): Promise<WriteResult>;
}
export {};
