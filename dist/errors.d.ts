export type ErrorCode = 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'INVALID_INPUT' | 'NOT_FOUND' | 'INSUFFICIENT_SCOPE' | 'INSUFFICIENT_CREDITS' | 'RATE_LIMITED' | 'ACTION_EXPIRED' | 'ACTION_CHANGED' | 'API_ERROR';
export declare class XCliError extends Error {
    readonly code: ErrorCode;
    readonly exitCode: number;
    readonly details?: Readonly<Record<string, unknown>> | undefined;
    constructor(code: ErrorCode, message: string, exitCode?: number, details?: Readonly<Record<string, unknown>> | undefined);
}
