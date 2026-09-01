export interface ExecFileOptions {
    timeout: number;
    shell: false;
}
export interface ExecFileResult {
    stdout: string;
    stderr: string;
}
export type ExecFileLike = (file: string, args: readonly string[], options: ExecFileOptions) => Promise<ExecFileResult>;
export declare const systemExecFile: ExecFileLike;
