import type { ParsedCommand } from './args.js';
import type { ActionInput, ActionPreview, WriteResult } from './actions/types.js';
import type { BrowserDescriptor, BrowserStatus } from './browser/types.js';
interface OAuthCommands {
    login(): Promise<unknown>;
    status(): Promise<unknown>;
    logout(): Promise<void>;
}
interface BrowserCommands {
    list(): Promise<BrowserDescriptor[]>;
    bind(username: string, browserKey: string): Promise<{
        expectedUsername: string;
        browserKey: string;
    }>;
    status(): Promise<BrowserStatus>;
}
interface ReadCommands {
    me(): Promise<{
        id: string;
        name: string;
        username: string;
    }>;
    forYouFeed(limit: number): Promise<unknown[]>;
    followingFeed(limit: number): Promise<unknown[]>;
    homeTimeline(limit: number): Promise<unknown[]>;
    followingTimeline(limit: number): Promise<unknown[]>;
    searchPosts(query: string, limit: number): Promise<unknown[]>;
    getPost(id: string): Promise<unknown>;
    getUser(username: string): Promise<{
        id: string;
        name: string;
        username: string;
    }>;
    isFollowing(username: string): Promise<{
        username: string;
        userId: string;
        following: boolean;
    }>;
    bookmarks(limit: number): Promise<unknown[]>;
    listDmConversations(limit: number): Promise<unknown[]>;
    readDmConversation(username: string, limit: number): Promise<unknown[]>;
}
interface Planner {
    plan(input: ActionInput, accountId: string): Promise<ActionPreview>;
}
interface Executor {
    execute(id: string): Promise<WriteResult & {
        actionId: string;
        kind: ActionPreview['kind'];
    }>;
}
export interface AppDependencies {
    oauth: OAuthCommands;
    browser: BrowserCommands;
    client: ReadCommands;
    planner: Planner;
    executor: Executor;
}
export declare function runCommand(command: ParsedCommand, dependencies: AppDependencies): Promise<string>;
export declare function createProductionApp(clientId: string): AppDependencies;
export {};
