import type { BrowserPost, BrowserUser, DirectMessage, DmConversation } from './types.js';
export declare function normalizeBrowserPosts(value: unknown, limit: number): BrowserPost[];
export declare function normalizeBrowserPost(value: unknown): BrowserPost;
export declare function normalizeBrowserUser(value: unknown): BrowserUser;
export declare function normalizeDmConversations(value: unknown, limit: number): DmConversation[];
export declare function normalizeDirectMessages(value: unknown, expectedUsername: string, limit: number): DirectMessage[];
