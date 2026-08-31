import type { ParsedCommand } from './args.js';
import type { ActionInput, ActionPreview } from './actions/types.js';
import { type WriteResult } from './api/writes.js';
interface OAuthCommands {
    login(): Promise<unknown>;
    status(): Promise<unknown>;
    logout(): Promise<void>;
}
interface ReadCommands {
    me(): Promise<{
        id: string;
        name: string;
        username: string;
    }>;
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
    client: ReadCommands;
    planner: Planner;
    executor: Executor;
}
export declare function runCommand(command: ParsedCommand, dependencies: AppDependencies): Promise<string>;
export declare function createProductionApp(clientId: string): AppDependencies;
export {};
