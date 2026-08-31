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
    async consume(id, accountId) {
        if (!/^act_[a-f0-9]{32}$/.test(id))
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
        if (preview.accountId !== accountId || preview.hash !== hashPreview(preview))
            throw changed();
        if (preview.expiresAt < this.now())
            throw new XCliError('ACTION_EXPIRED', 'Action approval has expired', 2);
        return preview;
    }
    path(id) { return join(this.root, `${id}.json`); }
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
