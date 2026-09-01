import { execFile } from 'node:child_process';
export const systemExecFile = (file, args, options) => new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8', timeout: options.timeout, shell: options.shell }, (error, stdout, stderr) => {
        if (error) {
            Object.assign(error, { stdout, stderr });
            reject(error);
            return;
        }
        resolve({ stdout, stderr });
    });
});
