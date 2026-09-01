interface BrowserLockOptions {
    pid?: number;
    now?: () => number;
    isProcessAlive?: (pid: number) => boolean;
}
export declare class BrowserLock {
    private readonly path;
    private readonly pid;
    private readonly now;
    private readonly isProcessAlive;
    constructor(path: string, options?: BrowserLockOptions);
    withLock<T>(work: () => Promise<T>): Promise<T>;
    private acquire;
    private recoverStale;
    private publish;
    private release;
    private read;
}
export {};
