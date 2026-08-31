import { XCliError } from './errors.js';
export function parsePostRef(value) {
    if (/^\d+$/.test(value))
        return value;
    try {
        const url = new URL(value);
        if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname))
            throw new Error();
        const match = url.pathname.match(/^\/[A-Za-z0-9_]+\/status\/(\d+)/);
        if (match?.[1])
            return match[1];
    }
    catch { }
    throw new XCliError('INVALID_INPUT', `Invalid X post reference: ${value}`);
}
export function normalizeUsername(value) {
    const username = value.startsWith('@') ? value.slice(1) : value;
    if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
        throw new XCliError('INVALID_INPUT', `Invalid X username: ${value}`);
    }
    return username;
}
