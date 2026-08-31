export type RequestKind = 'read' | 'write';
export interface ApiRequest {
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    kind: RequestKind;
    body?: unknown;
}
export interface RateLimit {
    limit?: number;
    remaining?: number;
    reset?: number;
}
export interface ApiResult<T> {
    data: T;
    rateLimit: RateLimit;
    status: number;
}
