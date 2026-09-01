type WithPretty = {
    pretty: boolean;
};
export type ParsedCommand = ({
    kind: 'auth-login' | 'auth-status' | 'auth-logout' | 'me';
} & WithPretty) | ({
    kind: 'browser-list' | 'browser-status';
} & WithPretty) | ({
    kind: 'browser-bind';
    username: string;
    browserKey: string;
} & WithPretty) | ({
    kind: 'feed-for-you' | 'feed-following';
    limit: number;
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
    kind: 'bookmark-list' | 'dm-list';
    limit: number;
} & WithPretty) | ({
    kind: 'bookmark-add' | 'bookmark-remove';
    postId: string;
} & WithPretty) | ({
    kind: 'dm-read';
    username: string;
    limit: number;
} & WithPretty) | ({
    kind: 'dm-send';
    username: string;
    text: string;
} & WithPretty) | ({
    kind: 'bulk-plan';
    inputPath: string;
} & WithPretty) | ({
    kind: 'bulk-execute';
    actionId: string;
} & WithPretty) | ({
    kind: 'action-execute';
    actionId: string;
} & WithPretty);
export declare function parseArgs(argv: readonly string[]): ParsedCommand;
export {};
