import type { ApiRequest, ApiResult } from './types.js';
import { type XPost, type XUser } from './normalize.js';
interface Requester {
    request<T>(request: ApiRequest): Promise<ApiResult<T>>;
}
export declare class XClient {
    private readonly transport;
    private accountId?;
    constructor(transport: Requester);
    me(): Promise<XUser>;
    homeTimeline(limit?: number): Promise<XPost[]>;
    followingTimeline(limit?: number): Promise<XPost[]>;
    searchPosts(query: string, limit?: number): Promise<XPost[]>;
    getPost(postId: string): Promise<XPost>;
    getUser(username: string): Promise<XUser>;
    isFollowing(username: string): Promise<{
        username: string;
        userId: string;
        following: boolean;
    }>;
}
export {};
