import type { BrowserBindingStore } from './config.js';
import type { BrowserAccountObservation, BrowserDescriptor, BrowserOperation, BrowserPost, BrowserStatus, BrowserUser, DirectMessage, DmConversation } from './types.js';
export type StatusObservation = BrowserAccountObservation;
interface OperationRunner {
    listBrowsers(): Promise<BrowserDescriptor[]>;
    run<T>(operation: BrowserOperation, browserKey: string): Promise<T>;
}
type BindingReader = Pick<BrowserBindingStore, 'get'>;
export declare class BrowserXClient {
    private readonly runner;
    private readonly bindings;
    constructor(runner: OperationRunner, bindings: BindingReader);
    listBrowsers(): Promise<BrowserDescriptor[]>;
    status(): Promise<BrowserStatus>;
    me(): Promise<{
        id: string;
        name: string;
        username: string;
    }>;
    forYouFeed(limit: number): Promise<BrowserPost[]>;
    followingFeed(limit: number): Promise<BrowserPost[]>;
    homeTimeline(limit: number): Promise<BrowserPost[]>;
    followingTimeline(limit: number): Promise<BrowserPost[]>;
    searchPosts(query: string, limit: number): Promise<BrowserPost[]>;
    getPost(postId: string): Promise<BrowserPost>;
    getUser(username: string): Promise<BrowserUser>;
    isFollowing(username: string): Promise<{
        username: string;
        userId: string;
        following: boolean;
    }>;
    bookmarks(limit: number): Promise<BrowserPost[]>;
    listDmConversations(limit: number): Promise<DmConversation[]>;
    readDmConversation(username: string, limit: number): Promise<DirectMessage[]>;
    private observeStatus;
    private read;
    private requiredBinding;
}
export declare function classifyStatusObservation(observation: StatusObservation, expectedUsername: string): BrowserStatus;
export declare function assertExpectedAccount(actualUsername: string, expectedUsername: string): void;
export {};
