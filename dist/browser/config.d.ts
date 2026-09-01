export interface BrowserBinding {
    expectedUsername: string;
    browserKey: string;
}
export declare class BrowserBindingStore {
    private readonly path;
    constructor(path: string);
    get(): Promise<BrowserBinding | null>;
    set(binding: BrowserBinding): Promise<void>;
}
