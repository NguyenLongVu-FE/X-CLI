import type { MediaDescriptor } from '../media.js';
export type ActionKind = 'post-create' | 'post-delete' | 'reply' | 'like' | 'unlike' | 'follow' | 'unfollow' | 'bookmark-add' | 'bookmark-remove' | 'dm-send';
export type ActionTarget = {
    postId: string;
} | {
    username: string;
    userId: string;
} | Record<string, never>;
export interface ActionInput {
    kind: ActionKind;
    target: ActionTarget;
    text?: string;
    media?: MediaDescriptor[];
}
export interface ActionPreview extends ActionInput {
    version: 1;
    id: string;
    accountId: string;
    createdAt: number;
    expiresAt: number;
    hash: string;
}
export interface WriteResult {
    outcome: 'confirmed' | 'unknown';
    resourceId?: string;
}
export interface BulkPreview {
    version: 1;
    id: string;
    accountId: string;
    kind: 'bulk';
    actions: ActionInput[];
    sourceHash: string;
    createdAt: number;
    expiresAt: number;
    hash: string;
}
export interface BulkItemResult {
    index: number;
    kind: ActionKind;
    outcome: WriteResult['outcome'];
    error?: string;
}
export interface BulkExecutionResult {
    actionId: string;
    stopped: boolean;
    stopCode?: string;
    results: BulkItemResult[];
}
