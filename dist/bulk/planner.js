import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hashPreview } from '../actions/store.js';
import { XCliError } from '../errors.js';
import { normalizeUsername } from '../identifiers.js';
import { describeMedia } from '../media.js';
import { BulkInputSchema } from './schema.js';
export class BulkPlanner {
    store;
    now;
    constructor(store, now = Date.now) {
        this.store = store;
        this.now = now;
    }
    async plan(path, accountId) {
        let source;
        let value;
        try {
            source = await readFile(path, 'utf8');
            value = JSON.parse(source);
        }
        catch {
            throw new XCliError('INVALID_INPUT', `Bulk input is missing or invalid JSON: ${path}`, 2);
        }
        return this.createPreview(parseBulk(value), accountId, createHash('sha256').update(source).digest('hex'));
    }
    async planValue(value, accountId) {
        const parsed = parseBulk(value);
        return this.createPreview(parsed, accountId, createHash('sha256').update(JSON.stringify(parsed)).digest('hex'));
    }
    async createPreview(parsed, accountId, sourceHash) {
        const account = normalizeUsername(parsed.account).toLowerCase();
        if (account !== accountId.toLowerCase())
            throw new XCliError('ACCOUNT_MISMATCH', `Bulk input is for @${account}, but @${accountId} is active`, 2);
        const actions = await Promise.all(parsed.actions.map(toActionInput));
        const createdAt = this.now();
        const unsigned = {
            version: 1,
            id: `act_${randomUUID().replaceAll('-', '').slice(0, 32)}`,
            accountId,
            kind: 'bulk',
            actions,
            sourceHash,
            createdAt,
            expiresAt: createdAt + 900_000
        };
        const preview = { ...unsigned, hash: hashPreview(unsigned) };
        await this.store.saveBulk(preview);
        return preview;
    }
}
function parseBulk(value) {
    const result = BulkInputSchema.safeParse(value);
    if (!result.success)
        throw new XCliError('INVALID_INPUT', 'Bulk input does not match the strict schema', 2);
    return result.data;
}
async function toActionInput(action) {
    const media = !('media' in action) || action.media === undefined ? undefined : await describeMedia(action.media);
    if ('postId' in action)
        return { kind: action.kind, target: { postId: action.postId }, ...('text' in action ? { text: action.text } : {}), ...(media ? { media } : {}) };
    if ('username' in action) {
        const username = normalizeUsername(action.username);
        return { kind: action.kind, target: { username, userId: username }, ...('text' in action ? { text: action.text } : {}), ...(media ? { media } : {}) };
    }
    return { kind: action.kind, target: {}, text: action.text, ...(media ? { media } : {}) };
}
