import { execFile } from 'node:child_process';
export const systemExecFile = (file, args, options) => new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8', timeout: options.timeout, shell: options.shell, env: sanitizePlaywriterEnvironment(process.env) }, (error, stdout, stderr) => {
        if (error) {
            Object.assign(error, { stdout, stderr });
            reject(error);
            return;
        }
        resolve({ stdout, stderr });
    });
});
export function sanitizePlaywriterEnvironment(environment) {
    return Object.fromEntries(Object.entries(environment).filter(([name]) => !name.startsWith('PLAYWRITER_')));
}
