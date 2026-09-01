import { XCliError } from '../errors.js';
import { normalizeBrowserPost, normalizeBrowserPosts, normalizeBrowserUser } from './normalize.js';
export class BrowserXClient {
    runner;
    bindings;
    constructor(runner, bindings) {
        this.runner = runner;
        this.bindings = bindings;
    }
    listBrowsers() {
        return this.runner.listBrowsers();
    }
    async status() {
        return (await this.observeStatus()).status;
    }
    async me() {
        const observed = await this.observeStatus();
        return {
            id: observed.status.username.toLowerCase(),
            name: observed.observation.displayName?.trim() || observed.status.username,
            username: observed.status.username
        };
    }
    async forYouFeed(limit) {
        return normalizeBrowserPosts(await this.read({ kind: 'read-feed', feed: 'for-you', limit }), limit);
    }
    async followingFeed(limit) {
        return normalizeBrowserPosts(await this.read({ kind: 'read-feed', feed: 'following', limit }), limit);
    }
    homeTimeline(limit) { return this.forYouFeed(limit); }
    followingTimeline(limit) { return this.followingFeed(limit); }
    async searchPosts(query, limit) {
        return normalizeBrowserPosts(await this.read({ kind: 'search-posts', query, limit }), limit);
    }
    async getPost(postId) {
        return normalizeBrowserPost(await this.read({ kind: 'read-post', postId }));
    }
    async getUser(username) {
        return normalizeBrowserUser(await this.read({ kind: 'read-user', username }));
    }
    async isFollowing(username) {
        const value = await this.read({ kind: 'check-following', username });
        const user = normalizeBrowserUser(value);
        if (typeof value !== 'object' || value === null || !('following' in value) || typeof value.following !== 'boolean') {
            throw new XCliError('X_UI_CHANGED', 'X following state was not visible', 2);
        }
        return { username: user.username, userId: user.id, following: value.following };
    }
    async bookmarks(limit) {
        return normalizeBrowserPosts(await this.read({ kind: 'read-bookmarks', limit }), limit);
    }
    async observeStatus() {
        const binding = await this.requiredBinding();
        const observation = await this.runner.run({ kind: 'status', expectedUsername: binding.expectedUsername }, binding.browserKey);
        return { status: classifyStatusObservation(observation, binding.expectedUsername), observation };
    }
    async read(operation) {
        const binding = await this.requiredBinding();
        const input = { ...operation, expectedUsername: binding.expectedUsername };
        const result = await this.runner.run(input, binding.browserKey);
        if (typeof result !== 'object' || result === null || !('account' in result)) {
            throw new XCliError('X_UI_CHANGED', 'X did not return an account observation', 2);
        }
        classifyStatusObservation(result.account, binding.expectedUsername);
        if (result.state === 'not-found')
            throw new XCliError('TARGET_NOT_FOUND', 'The requested X resource was not found', 3);
        if (result.state !== 'ok' || result.value === null || result.value === undefined) {
            throw new XCliError('X_UI_CHANGED', 'X returned an unexpected visible page structure', 2);
        }
        return result.value;
    }
    async requiredBinding() {
        const binding = await this.bindings.get();
        if (binding === null) {
            throw new XCliError('INVALID_INPUT', 'No Chrome profile is bound; run x browser list and x browser bind first', 2);
        }
        return binding;
    }
}
export function classifyStatusObservation(observation, expectedUsername) {
    let url;
    try {
        url = new URL(observation.url);
    }
    catch {
        throw new XCliError('BROWSER_DISCONNECTED', 'X returned an invalid page URL', 2);
    }
    if (!['x.com', 'www.x.com'].includes(url.hostname)) {
        throw new XCliError('BROWSER_DISCONNECTED', 'The selected Chrome profile did not load X', 2);
    }
    if (url.pathname.startsWith('/account/access') || /verify your identity|confirm your account/i.test(observation.snapshot)) {
        throw new XCliError('CHALLENGE_REQUIRED', 'X requires an account challenge to be completed in Chrome', 2);
    }
    if (observation.profileHref === null) {
        if (url.pathname === '/' || /log in|sign in|create account/i.test(observation.snapshot)) {
            throw new XCliError('LOGIN_REQUIRED', 'Log in to X in the bound Chrome profile', 2);
        }
        throw new XCliError('X_UI_CHANGED', 'The authenticated X profile control was not found', 2);
    }
    const username = usernameFromProfileHref(observation.profileHref);
    assertExpectedAccount(username, expectedUsername);
    return { connected: true, authenticated: true, username };
}
export function assertExpectedAccount(actualUsername, expectedUsername) {
    if (actualUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
        throw new XCliError('ACCOUNT_MISMATCH', `Bound Chrome profile is @${actualUsername}, expected @${expectedUsername}`, 2);
    }
}
function usernameFromProfileHref(href) {
    try {
        const path = new URL(href, 'https://x.com').pathname;
        const match = path.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
        if (match?.[1] !== undefined)
            return match[1];
    }
    catch { }
    throw new XCliError('X_UI_CHANGED', 'The X profile link has an unexpected format', 2);
}
