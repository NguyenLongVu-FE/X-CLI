import type { BrowserDescriptor } from './types.js';
export interface BrowserBinding {
    expectedUsername: string;
    browserKey: string;
}
export declare function assertSupportedBrowser(browser: BrowserDescriptor): void;
export declare class BrowserBindingStore {
    private readonly path;
    constructor(path: string);
    get(): Promise<BrowserBinding | null>;
    set(binding: BrowserBinding): Promise<void>;
}
