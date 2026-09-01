import { execFile } from 'node:child_process';

export interface ExecFileOptions {
  timeout: number;
  shell: false;
}

export interface ExecFileResult {
  stdout: string;
  stderr: string;
}

export type ExecFileLike = (
  file: string,
  args: readonly string[],
  options: ExecFileOptions
) => Promise<ExecFileResult>;

export const systemExecFile: ExecFileLike = (file, args, options) => new Promise((resolve, reject) => {
  execFile(file, args, { encoding: 'utf8', timeout: options.timeout, shell: options.shell }, (error, stdout, stderr) => {
    if (error) {
      Object.assign(error, { stdout, stderr });
      reject(error);
      return;
    }
    resolve({ stdout, stderr });
  });
});
