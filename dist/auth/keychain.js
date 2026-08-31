import { Entry } from '@napi-rs/keyring';
import { z } from 'zod';
import { XCliError } from '../errors.js';
const SERVICE = 'com.nguyenlongvu.x-cli';
const ACCOUNT = 'oauth-tokens';
const tokenSchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number().finite(),
    scope: z.array(z.string())
});
export class MacOsKeychainStore {
    entry;
    constructor(createEntry = (service, account) => new Entry(service, account)) {
        this.entry = createEntry(SERVICE, ACCOUNT);
    }
    async get() {
        try {
            const value = this.entry.getPassword();
            if (value === null)
                return null;
            const parsed = tokenSchema.safeParse(JSON.parse(value));
            if (!parsed.success)
                throw keychainError('parse');
            return parsed.data;
        }
        catch (error) {
            if (error instanceof XCliError)
                throw error;
            throw keychainError('read');
        }
    }
    async set(tokens) {
        try {
            this.entry.setPassword(JSON.stringify(tokens));
        }
        catch {
            throw keychainError('write');
        }
    }
    async delete() {
        try {
            this.entry.deletePassword();
        }
        catch {
            throw keychainError('delete');
        }
    }
}
function keychainError(operation) {
    return new XCliError('AUTH_REQUIRED', `Unable to ${operation} OAuth credentials in macOS Keychain`, 2);
}
