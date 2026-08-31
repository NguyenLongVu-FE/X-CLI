type WithPretty = {
    pretty: boolean;
};
export type ParsedCommand = ({
    kind: 'auth-login' | 'auth-status' | 'auth-logout' | 'me';
} & WithPretty) | ({
    kind: 'timeline-home' | 'timeline-following';
    limit: number;
} & WithPretty) | ({
    kind: 'search-posts';
    query: string;
    limit: number;
} & WithPretty) | ({
    kind: 'post-get';
    postId: string;
} & WithPretty) | ({
    kind: 'post-delete';
    postId: string;
} & WithPretty) | ({
    kind: 'user-get';
    username: string;
} & WithPretty) | ({
    kind: 'following-check';
    username: string;
} & WithPretty) | ({
    kind: 'post-create';
    text: string;
} & WithPretty) | ({
    kind: 'reply';
    postId: string;
    text: string;
} & WithPretty) | ({
    kind: 'like' | 'unlike';
    postId: string;
} & WithPretty) | ({
    kind: 'follow' | 'unfollow';
    username: string;
} & WithPretty) | ({
    kind: 'action-execute';
    actionId: string;
} & WithPretty);
export declare function parseArgs(argv: readonly string[]): ParsedCommand;
export {};
