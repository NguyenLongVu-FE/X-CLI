import { XCliError } from '../errors.js';
export function normalizeBrowserPosts(value, limit) {
    if (!Array.isArray(value))
        throw changed();
    const seen = new Set();
    const posts = [];
    for (const entry of value) {
        const post = normalizeBrowserPost(entry);
        if (seen.has(post.url))
            continue;
        seen.add(post.url);
        posts.push(post);
        if (posts.length === limit)
            break;
    }
    return posts;
}
export function normalizeBrowserPost(value) {
    const entry = record(value);
    const url = canonicalPostUrl(text(entry.url));
    const match = new URL(url).pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/);
    if (match === null)
        throw changed();
    const authorUsername = username(typeof entry.authorUsername === 'string' ? entry.authorUsername : match[1]);
    const post = { id: match[2], url, text: text(entry.text), authorUsername };
    if (typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt)))
        post.createdAt = entry.createdAt;
    const metrics = normalizeMetrics(entry.metrics);
    if (metrics !== undefined)
        post.metrics = metrics;
    return post;
}
export function normalizeBrowserUser(value) {
    const entry = record(value);
    const normalizedUsername = username(text(entry.username));
    const user = {
        id: normalizedUsername,
        url: `https://x.com/${normalizedUsername}`,
        username: normalizedUsername,
        name: text(entry.name)
    };
    if (typeof entry.description === 'string' && entry.description.trim() !== '')
        user.description = entry.description;
    return user;
}
export function normalizeDmConversations(value, limit) {
    if (!Array.isArray(value))
        throw changed();
    return value.slice(0, limit).map((entry) => {
        const source = record(entry);
        const normalizedUsername = username(text(source.username));
        const url = new URL(text(source.url), 'https://x.com');
        if (!['x.com', 'www.x.com'].includes(url.hostname) || !/^(?:\/messages(?:\/[A-Za-z0-9_-]+)?|\/i\/chat)$/.test(url.pathname))
            throw changed();
        return { username: normalizedUsername, name: text(source.name), url: `https://x.com${url.pathname}` };
    });
}
export function normalizeDirectMessages(value, expectedUsername, limit) {
    const source = record(value);
    const conversationUsername = username(text(source.conversationUsername));
    if (conversationUsername !== username(expectedUsername) || !Array.isArray(source.messages))
        throw changed();
    return source.messages.slice(-limit).map((entry) => {
        const message = record(entry);
        const normalized = {
            conversationUsername,
            senderUsername: username(text(message.senderUsername)),
            text: text(message.text)
        };
        if (typeof message.sentAt === 'string' && !Number.isNaN(Date.parse(message.sentAt)))
            normalized.sentAt = message.sentAt;
        return normalized;
    });
}
function canonicalPostUrl(value) {
    let url;
    try {
        url = new URL(value, 'https://x.com');
    }
    catch {
        throw changed();
    }
    const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
    if (match === null)
        throw changed();
    return `https://x.com/${match[1].toLowerCase()}/status/${match[2]}`;
}
function normalizeMetrics(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return undefined;
    const source = value;
    const metrics = {};
    for (const key of ['replies', 'reposts', 'likes', 'views']) {
        const number = metric(source[key]);
        if (number !== undefined)
            metrics[key] = number;
    }
    return Object.keys(metrics).length === 0 ? undefined : metrics;
}
function metric(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
        return Math.round(value);
    if (typeof value !== 'string')
        return undefined;
    const match = value.trim().replaceAll(',', '').match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
    if (match === null)
        return undefined;
    const scale = { K: 1_000, M: 1_000_000, B: 1_000_000_000 }[match[2]?.toUpperCase()] ?? 1;
    return Math.round(Number(match[1]) * scale);
}
function record(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw changed();
    return value;
}
function text(value) {
    if (typeof value !== 'string')
        throw changed();
    return value;
}
function username(value) {
    const normalized = value.replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{1,15}$/.test(normalized))
        throw changed();
    return normalized;
}
function changed() {
    return new XCliError('X_UI_CHANGED', 'X returned an unexpected visible page structure', 2);
}
