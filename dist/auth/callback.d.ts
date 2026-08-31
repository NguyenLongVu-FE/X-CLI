export interface OAuthCallback {
    code: string;
    state: string;
}
export declare function receiveOAuthCallback(options?: {
    port?: number;
    timeoutMs?: number;
}): Promise<OAuthCallback>;
