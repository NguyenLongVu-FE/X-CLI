import type { ActionPreview } from '../actions/types.js';
import type { ApiRequest, ApiResult } from './types.js';
interface Requester {
    request<T>(request: ApiRequest): Promise<ApiResult<T>>;
}
export interface WriteResult {
    outcome: 'confirmed' | 'unknown';
    resourceId?: string;
}
export declare class XWrites {
    private readonly transport;
    constructor(transport: Requester);
    execute(action: ActionPreview): Promise<WriteResult>;
}
export {};
