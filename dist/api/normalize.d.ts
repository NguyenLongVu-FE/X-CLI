export interface XUser {
    id: string;
    name: string;
    username: string;
    description?: string;
    publicMetrics?: Readonly<Record<string, number>>;
}
export interface XPost {
    id: string;
    text: string;
    authorId?: string;
    createdAt?: string;
    conversationId?: string;
    publicMetrics?: Readonly<Record<string, number>>;
}
export declare function normalizeUser(value: Record<string, unknown>): XUser;
export declare function normalizePost(value: Record<string, unknown>): XPost;
