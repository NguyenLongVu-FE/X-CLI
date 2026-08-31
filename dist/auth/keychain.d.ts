import type { CredentialStore, OAuthTokens } from './credentials.js';
export interface KeychainEntry {
    getPassword(): string | null;
    setPassword(value: string): void;
    deletePassword(): boolean | void;
}
export type EntryFactory = (service: string, account: string) => KeychainEntry;
export declare class MacOsKeychainStore implements CredentialStore {
    private readonly entry;
    constructor(createEntry?: EntryFactory);
    get(): Promise<OAuthTokens | null>;
    set(tokens: OAuthTokens): Promise<void>;
    delete(): Promise<void>;
}
