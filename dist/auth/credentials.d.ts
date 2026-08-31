export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string[];
}
export interface CredentialStore {
    get(): Promise<OAuthTokens | null>;
    set(tokens: OAuthTokens): Promise<void>;
    delete(): Promise<void>;
}
