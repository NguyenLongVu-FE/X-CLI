import { XCliError } from './errors.js';
import { normalizeUsername, parsePostRef } from './identifiers.js';
export function parseArgs(argv) {
    const { positional, options } = split(argv);
    const pretty = takeBoolean(options, 'pretty');
    const command = positional.join(' ');
    let result;
    if (command === 'auth login' || command === 'auth status' || command === 'auth logout' || command === 'me') {
        result = { kind: command.replace(' ', '-'), pretty };
    }
    else if (command === 'browser list' || command === 'browser status') {
        result = { kind: command.replace(' ', '-'), pretty };
    }
    else if (positional[0] === 'browser' && positional[1] === 'bind' && positional.length === 3) {
        result = { kind: 'browser-bind', username: normalizeUsername(positional[2]), browserKey: takeBrowserKey(options), pretty };
    }
    else if (positional[0] === 'feed' && ['for-you', 'following'].includes(positional[1] ?? '') && positional.length === 2) {
        result = { kind: `feed-${positional[1]}`, limit: takeLimit(options), pretty };
    }
    else if (positional[0] === 'timeline' && ['home', 'following'].includes(positional[1] ?? '') && positional.length === 2) {
        result = { kind: `timeline-${positional[1]}`, limit: takeLimit(options), pretty };
    }
    else if (positional[0] === 'search' && positional[1] === 'posts' && positional.length === 3) {
        result = { kind: 'search-posts', query: positional[2], limit: takeLimit(options), pretty };
    }
    else if (positional[0] === 'post' && positional[1] === 'get' && positional.length === 3) {
        result = { kind: 'post-get', postId: parsePostRef(positional[2]), pretty };
    }
    else if (positional[0] === 'post' && positional[1] === 'delete' && positional.length === 3) {
        result = { kind: 'post-delete', postId: parsePostRef(positional[2]), pretty };
    }
    else if (positional[0] === 'user' && positional[1] === 'get' && positional.length === 3) {
        result = { kind: 'user-get', username: normalizeUsername(positional[2]), pretty };
    }
    else if (positional[0] === 'following' && positional[1] === 'check' && positional.length === 3) {
        result = { kind: 'following-check', username: normalizeUsername(positional[2]), pretty };
    }
    else if (positional[0] === 'post' && positional[1] === 'create' && positional.length === 2) {
        const media = takeMedia(options);
        result = { kind: 'post-create', text: takeText(options), ...(media.length === 0 ? {} : { media }), pretty };
    }
    else if (positional[0] === 'reply' && positional.length === 2) {
        const media = takeMedia(options);
        result = { kind: 'reply', postId: parsePostRef(positional[1]), text: takeText(options), ...(media.length === 0 ? {} : { media }), pretty };
    }
    else if (['like', 'unlike'].includes(positional[0] ?? '') && positional.length === 2) {
        result = { kind: positional[0], postId: parsePostRef(positional[1]), pretty };
    }
    else if (['follow', 'unfollow'].includes(positional[0] ?? '') && positional.length === 2) {
        result = { kind: positional[0], username: normalizeUsername(positional[1]), pretty };
    }
    else if (command === 'bookmark list') {
        result = { kind: 'bookmark-list', limit: takeLimit(options), pretty };
    }
    else if (positional[0] === 'bookmark' && ['add', 'remove'].includes(positional[1] ?? '') && positional.length === 3) {
        result = { kind: `bookmark-${positional[1]}`, postId: parsePostRef(positional[2]), pretty };
    }
    else if (command === 'dm list') {
        result = { kind: 'dm-list', limit: takeLimit(options), pretty };
    }
    else if (positional[0] === 'dm' && positional[1] === 'read' && positional.length === 3) {
        result = { kind: 'dm-read', username: normalizeUsername(positional[2]), limit: takeLimit(options), pretty };
    }
    else if (positional[0] === 'dm' && positional[1] === 'send' && positional.length === 3) {
        const media = takeMedia(options);
        if (media.length > 1)
            throw new XCliError('INVALID_INPUT', 'DM accepts at most one media path');
        result = { kind: 'dm-send', username: normalizeUsername(positional[2]), text: takeText(options), ...(media.length === 0 ? {} : { media }), pretty };
    }
    else if (command === 'bulk plan') {
        result = { kind: 'bulk-plan', inputPath: takeInputPath(options), pretty };
    }
    else if (positional[0] === 'bulk' && positional[1] === 'execute' && positional.length === 3) {
        result = { kind: 'bulk-execute', actionId: positional[2], pretty };
    }
    else if (positional[0] === 'action' && positional[1] === 'execute' && positional.length === 3) {
        result = { kind: 'action-execute', actionId: positional[2], pretty };
    }
    else {
        throw new XCliError('INVALID_INPUT', `Unknown command: ${command || '(empty)'}`);
    }
    const unknown = options.keys().next().value;
    if (unknown !== undefined)
        throw new XCliError('INVALID_INPUT', `Unknown option: --${unknown}`);
    return result;
}
function split(argv) {
    const positional = [];
    const options = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (!value.startsWith('--')) {
            positional.push(value);
            continue;
        }
        const name = value.slice(2);
        if (name === 'pretty' || !['limit', 'text', 'input', 'browser', 'media'].includes(name)) {
            options.set(name, true);
            continue;
        }
        const next = argv[index + 1];
        if (next === undefined || next.startsWith('--'))
            throw new XCliError('INVALID_INPUT', `Missing value for --${name}`);
        if (name === 'media') {
            const previous = options.get(name);
            options.set(name, [...(Array.isArray(previous) ? previous : []), next]);
        }
        else {
            options.set(name, next);
        }
        index += 1;
    }
    return { positional, options };
}
function takeBoolean(options, name) {
    const value = options.get(name);
    options.delete(name);
    return value === true;
}
function takeLimit(options) {
    const value = options.get('limit');
    options.delete('limit');
    if (value === undefined)
        return 20;
    const limit = typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new XCliError('INVALID_INPUT', '--limit must be between 1 and 100');
    return limit;
}
function takeText(options) {
    const value = options.get('text');
    options.delete('text');
    if (typeof value !== 'string' || value.trim() === '')
        throw new XCliError('INVALID_INPUT', 'Post text is required');
    if (Array.from(value).length > 280)
        throw new XCliError('INVALID_INPUT', 'Post text must be at most 280 characters');
    return value;
}
function takeInputPath(options) {
    const value = options.get('input');
    options.delete('input');
    if (typeof value !== 'string' || value.trim() === '')
        throw new XCliError('INVALID_INPUT', 'Bulk input file is required');
    return value;
}
function takeBrowserKey(options) {
    const value = options.get('browser');
    options.delete('browser');
    if (typeof value !== 'string' || !/^[^\s\u0000-\u001f\u007f]{1,200}$/.test(value)) {
        throw new XCliError('INVALID_INPUT', 'Browser key is required');
    }
    return value;
}
function takeMedia(options) {
    const value = options.get('media');
    options.delete('media');
    return Array.isArray(value) ? value : [];
}
