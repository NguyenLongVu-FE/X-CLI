import { type ExecFileLike } from './process.js';
import type { BrowserDescriptor, BrowserOperation } from './types.js';
interface PlaywriterRunnerOptions {
    execFile?: ExecFileLike;
    buildProgram?: (operation: BrowserOperation) => string;
    timeoutMs?: number;
    binary?: string;
    withLock?: <T>(work: () => Promise<T>) => Promise<T>;
}
export declare class PlaywriterRunner {
    private readonly execFile;
    private readonly timeoutMs;
    private readonly binary;
    private readonly buildProgram;
    private readonly withLock;
    constructor(options?: PlaywriterRunnerOptions);
    listBrowsers(): Promise<BrowserDescriptor[]>;
    run<T>(operation: BrowserOperation, browserKey: string): Promise<T>;
    private runInSession;
    private call;
}
export declare function parseMarkedJson<T>(stdout: string): T;
export declare function redactDiagnostic(_value: string): string;
export {};
