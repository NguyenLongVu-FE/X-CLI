import type { ActionPreview, WriteResult } from '../actions/types.js';
import type { ApiRequest, ApiResult } from './types.js';
interface Requester {
    request<T>(request: ApiRequest): Promise<ApiResult<T>>;
}
export type { WriteResult } from '../actions/types.js';
export declare class XWrites {
    private readonly transport;
    constructor(transport: Requester);
    execute(action: ActionPreview): Promise<WriteResult>;
}
