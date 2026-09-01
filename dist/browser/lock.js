import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { XCliError } from '../errors.js';
export class BrowserLock {
    path;
    pid;
    now;
    isProcessAlive;
    constructor(path, options = {}) {
        this.path = path;
        this.pid = options.pid ?? process.pid;
        this.now = options.now ?? Date.now;
        this.isProcessAlive = options.isProcessAlive ?? processIsAlive;
    }
    async withLock(work) {
        const record = { pid: this.pid, startedAt: this.now(), token: randomUUID() };
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        await this.acquire(record);
        try {
            return await work();
        }
        finally {
            await this.release(record.token);
        }
    }
    async acquire(record) {
        if (await this.publish(record))
            return;
        const existing = await this.read();
        if (existing === null)
            throw new XCliError('BROWSER_BUSY', 'The browser command lock is incomplete or unreadable', 2);
        if (existing !== undefined && this.isProcessAlive(existing.pid)) {
            throw new XCliError('BROWSER_BUSY', 'Another X-CLI browser command is already running', 2);
        }
        if (existing !== undefined) {
            await unlink(this.path).catch((error) => {
                if (!hasCode(error, 'ENOENT'))
                    throw error;
            });
        }
        if (!await this.publish(record)) {
            throw new XCliError('BROWSER_BUSY', 'Another X-CLI browser command acquired the lock', 2);
        }
    }
    async publish(record) {
        const temporary = `${this.path}.${record.pid}.${record.token}.tmp`;
        try {
            await writeFile(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
            try {
                await link(temporary, this.path);
                return true;
            }
            catch (error) {
                if (hasCode(error, 'EEXIST'))
                    return false;
                throw error;
            }
        }
        catch (error) {
            if (hasCode(error, 'EEXIST'))
                return false;
            throw new XCliError('BROWSER_BUSY', 'Unable to acquire browser command lock', 2);
        }
        finally {
            await unlink(temporary).catch(() => undefined);
        }
    }
    async release(token) {
        const existing = await this.read();
        if (existing !== null && existing !== undefined && existing.token === token)
            await unlink(this.path).catch(() => undefined);
    }
    async read() {
        try {
            const value = JSON.parse(await readFile(this.path, 'utf8'));
            if (typeof value.pid !== 'number' || typeof value.startedAt !== 'number' || typeof value.token !== 'string')
                return null;
            return value;
        }
        catch (error) {
            if (hasCode(error, 'ENOENT'))
                return undefined;
            return null;
        }
    }
}
function processIsAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return hasCode(error, 'EPERM');
    }
}
function hasCode(error, code) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
