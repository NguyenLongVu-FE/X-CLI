import { homedir } from 'node:os';
import { join } from 'node:path';
import { ActionExecutor } from './actions/executor.js';
import { ActionPlanner } from './actions/planner.js';
import { ActionStore } from './actions/store.js';
import { BrowserXClient } from './browser/client.js';
import { assertSupportedBrowser, BrowserBindingStore } from './browser/config.js';
import { PlaywriterRunner } from './browser/runner.js';
import { BrowserXWriter } from './browser/writer.js';
import { BulkExecutor } from './bulk/executor.js';
import { BulkPlanner } from './bulk/planner.js';
import { XCliError } from './errors.js';
import { describeMedia } from './media.js';
export async function runCommand(command, dependencies) {
    let value;
    let collection = false;
    switch (command.kind) {
        case 'auth-login':
            value = await dependencies.auth.login();
            break;
        case 'auth-status':
            value = await dependencies.auth.status();
            break;
        case 'auth-logout':
            await dependencies.auth.logout();
            value = { authenticated: false };
            break;
        case 'browser-list':
            value = await dependencies.browser.list();
            collection = true;
            break;
        case 'browser-bind':
            value = await dependencies.browser.bind(command.username, command.browserKey);
            break;
        case 'browser-status':
            value = await dependencies.browser.status();
            break;
        case 'me':
            value = await dependencies.client.me();
            break;
        case 'feed-for-you':
            value = await dependencies.client.forYouFeed(command.limit);
            collection = true;
            break;
        case 'feed-following':
            value = await dependencies.client.followingFeed(command.limit);
            collection = true;
            break;
        case 'timeline-home':
            value = await dependencies.client.homeTimeline(command.limit);
            collection = true;
            break;
        case 'timeline-following':
            value = await dependencies.client.followingTimeline(command.limit);
            collection = true;
            break;
        case 'search-posts':
            value = await dependencies.client.searchPosts(command.query, command.limit);
            collection = true;
            break;
        case 'post-get':
            value = await dependencies.client.getPost(command.postId);
            break;
        case 'post-delete':
            value = await plan(dependencies, { kind: 'post-delete', target: { postId: command.postId } });
            break;
        case 'user-get':
            value = await dependencies.client.getUser(command.username);
            break;
        case 'following-check':
            value = await dependencies.client.isFollowing(command.username);
            break;
        case 'post-create':
            value = await plan(dependencies, { kind: 'post-create', target: {}, text: command.text }, command.media);
            break;
        case 'reply':
            value = await plan(dependencies, { kind: 'reply', target: { postId: command.postId }, text: command.text }, command.media);
            break;
        case 'like':
            value = await plan(dependencies, { kind: 'like', target: { postId: command.postId } });
            break;
        case 'unlike':
            value = await plan(dependencies, { kind: 'unlike', target: { postId: command.postId } });
            break;
        case 'bookmark-list':
            value = await dependencies.client.bookmarks(command.limit);
            collection = true;
            break;
        case 'bookmark-add':
            value = await plan(dependencies, { kind: 'bookmark-add', target: { postId: command.postId } });
            break;
        case 'bookmark-remove':
            value = await plan(dependencies, { kind: 'bookmark-remove', target: { postId: command.postId } });
            break;
        case 'dm-list':
            value = await dependencies.client.listDmConversations(command.limit);
            collection = true;
            break;
        case 'dm-read':
            value = await dependencies.client.readDmConversation(command.username, command.limit);
            collection = true;
            break;
        case 'dm-send':
            value = await plan(dependencies, {
                kind: 'dm-send', target: { username: command.username, userId: command.username }, text: command.text
            }, command.media);
            break;
        case 'follow':
        case 'unfollow': {
            const target = await dependencies.client.getUser(command.username);
            value = await plan(dependencies, { kind: command.kind, target: { username: target.username, userId: target.id } });
            break;
        }
        case 'action-execute':
            value = await dependencies.executor.execute(command.actionId);
            break;
        case 'bulk-plan':
            value = await dependencies.bulkPlanner.plan(command.inputPath, (await dependencies.client.me()).id);
            break;
        case 'bulk-execute':
            value = await dependencies.bulkExecutor.execute(command.actionId);
            break;
    }
    if (command.pretty)
        return `${JSON.stringify(value, null, 2)}\n`;
    if (collection)
        return value.map((entry) => JSON.stringify(entry)).join('\n') + (value.length ? '\n' : '');
    return `${JSON.stringify(value)}\n`;
}
async function plan(dependencies, input, mediaPaths) {
    const media = mediaPaths === undefined ? undefined : await describeMedia(mediaPaths);
    const account = await dependencies.client.me();
    return dependencies.planner.plan({ ...input, ...(media === undefined ? {} : { media }) }, account.id);
}
export function createProductionApp() {
    const supportRoot = join(homedir(), 'Library', 'Application Support', 'x-cli');
    const bindings = new BrowserBindingStore(join(supportRoot, 'browser.json'));
    const runner = new PlaywriterRunner();
    const client = new BrowserXClient(runner, bindings);
    const writer = new BrowserXWriter(runner, bindings);
    const store = new ActionStore(join(supportRoot, 'actions'));
    return {
        auth: {
            login: async () => { throw browserSessionOnly(); },
            status: () => client.status(),
            logout: async () => { throw browserSessionOnly(); }
        },
        browser: {
            list: () => client.listBrowsers(),
            bind: async (expectedUsername, browserKey) => {
                const available = await client.listBrowsers();
                const selected = available.find((browser) => browser.key === browserKey);
                if (selected === undefined) {
                    throw new XCliError('BROWSER_DISCONNECTED', 'The selected Playwriter browser key is not available', 2);
                }
                assertSupportedBrowser(selected);
                const binding = { expectedUsername, browserKey };
                await bindings.set(binding);
                return binding;
            },
            status: () => client.status()
        },
        client,
        planner: new ActionPlanner(store),
        executor: new ActionExecutor(store, async () => (await client.me()).id, writer),
        bulkPlanner: new BulkPlanner(store),
        bulkExecutor: new BulkExecutor(store, async () => (await client.me()).id, writer)
    };
}
function browserSessionOnly() {
    return new XCliError('INVALID_INPUT', 'Sign in or out directly in the bound Chrome profile; x-cli never handles X credentials', 2);
}
