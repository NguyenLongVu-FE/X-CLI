import type { CredentialStore, OAuthTokens } from './credentials.js';
import { type PkceValues } from './pkce.js';
import { type OAuthCallback } from './callback.js';
export declare const REQUIRED_SCOPES: readonly ["tweet.read", "tweet.write", "users.read", "like.read", "like.write", "follows.read", "follows.write", "offline.access"];
export interface OAuthDependencies {
    store: CredentialStore;
    fetch: typeof globalThis.fetch;
    openBrowser: (url: string) => Promise<void>;
    receiveCallback: () => Promise<OAuthCallback>;
    createPkce?: () => PkceValues;
    now?: () => number;
}
interface BrowserOpenerOptions {
    manual: boolean;
    write: (value: string) => void;
    open: (url: string) => Promise<void>;
}
export declare function createBrowserOpener(options: BrowserOpenerOptions): (url: string) => Promise<void>;
export declare class OAuthClient {
    private readonly clientId;
    private readonly dependencies;
    constructor(clientId: string, dependencies: OAuthDependencies);
    login(): Promise<{
        authenticated: true;
        expiresAt: number;
        scope: string[];
    }>;
    refresh(): Promise<OAuthTokens>;
    status(): Promise<{
        authenticated: false;
    } | {
        authenticated: true;
        expiresAt: number;
        scope: string[];
    }>;
    logout(): Promise<void>;
    private exchange;
}
export declare function createOAuthClient(clientId: string, store: CredentialStore): OAuthClient;
export {};
