import type { CredentialStore, OAuthTokens } from '../auth/credentials.js';
import type { ApiRequest, ApiResult } from './types.js';
export interface TransportDependencies {
    store: CredentialStore;
    refresh: () => Promise<OAuthTokens>;
    fetch: typeof globalThis.fetch;
    baseUrl?: string;
    timeoutMs?: number;
}
export declare class XTransport {
    private readonly dependencies;
    constructor(dependencies: TransportDependencies);
    request<T = unknown>(request: ApiRequest): Promise<ApiResult<T>>;
}
