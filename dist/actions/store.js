import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { XCliError } from '../errors.js';
export class ActionStore {
    root;
    now;
    constructor(root, now = Date.now) {
        this.root = root;
        this.now = now;
    }
    async save(preview) {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        await writeFile(this.path(preview.id), `${JSON.stringify(preview)}\n`, { mode: 0o600, flag: 'wx' });
    }
    async saveBulk(preview) {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        await writeFile(this.path(preview.id), `${JSON.stringify(preview)}\n`, { mode: 0o600, flag: 'wx' });
    }
    async inspectBulk(id, accountId) {
        const preview = await this.readBulk(id);
        this.validateBulk(preview, accountId);
        return preview;
    }
    async consumeBulk(id, accountId) {
        if (!validId(id))
            throw changed();
        const consuming = join(this.root, `${id}.consuming`);
        try {
            await rename(this.path(id), consuming);
        }
        catch {
            throw changed();
        }
        let preview;
        try {
            preview = JSON.parse(await readFile(consuming, 'utf8'));
        }
        catch {
            await unlink(consuming).catch(() => { });
            throw changed();
        }
        await unlink(consuming).catch(() => { });
        this.validateBulk(preview, accountId);
        return preview;
    }
    async saveBulkResult(result) {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        const destination = this.resultPath(result.actionId);
        const temporary = `${destination}.${process.pid}.tmp`;
        await writeFile(temporary, `${JSON.stringify(result)}\n`, { mode: 0o600 });
        await rename(temporary, destination);
    }
    async readBulkResult(id) {
        if (!validId(id))
            throw changed();
        try {
            return JSON.parse(await readFile(this.resultPath(id), 'utf8'));
        }
        catch {
            throw changed();
        }
    }
    async inspect(id, accountId) {
        if (!validId(id))
            throw changed();
        let preview;
        try {
            preview = JSON.parse(await readFile(this.path(id), 'utf8'));
        }
        catch {
            throw changed();
        }
        this.validate(preview, accountId);
        return preview;
    }
    async consume(id, accountId) {
        if (!validId(id))
            throw changed();
        const source = this.path(id);
        const consuming = join(this.root, `${id}.consuming`);
        try {
            await rename(source, consuming);
        }
        catch {
            throw changed();
        }
        let preview;
        try {
            preview = JSON.parse(await readFile(consuming, 'utf8'));
        }
        catch {
            await unlink(consuming).catch(() => { });
            throw changed();
        }
        await unlink(consuming).catch(() => { });
        this.validate(preview, accountId);
        return preview;
    }
    path(id) { return join(this.root, `${id}.json`); }
    resultPath(id) { return join(this.root, `${id}.result.json`); }
    async readBulk(id) {
        if (!validId(id))
            throw changed();
        try {
            return JSON.parse(await readFile(this.path(id), 'utf8'));
        }
        catch {
            throw changed();
        }
    }
    validate(preview, accountId) {
        if (preview.accountId !== accountId || preview.hash !== hashPreview(preview))
            throw changed();
        if (preview.expiresAt < this.now())
            throw new XCliError('ACTION_EXPIRED', 'Action approval has expired', 2);
    }
    validateBulk(preview, accountId) {
        if (preview.kind !== 'bulk' || preview.accountId !== accountId || preview.hash !== hashPreview(preview))
            throw changed();
        if (preview.expiresAt < this.now())
            throw new XCliError('ACTION_EXPIRED', 'Bulk approval has expired', 2);
    }
}
export function hashPreview(preview) {
    const { hash: _hash, ...unsigned } = preview;
    return createHash('sha256').update(stableStringify(unsigned)).digest('hex');
}
function stableStringify(value) {
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    if (typeof value === 'object' && value !== null) {
        return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
function changed() { return new XCliError('ACTION_CHANGED', 'Action approval is missing, changed, or already consumed', 2); }
function validId(id) { return /^act_[a-f0-9]{32}$/.test(id); }
