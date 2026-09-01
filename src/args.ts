import { XCliError } from './errors.js';
import { normalizeUsername, parsePostRef } from './identifiers.js';

type WithPretty = { pretty: boolean };
export type ParsedCommand =
  | ({ kind: 'auth-login' | 'auth-status' | 'auth-logout' | 'me' } & WithPretty)
  | ({ kind: 'browser-status' } & WithPretty)
  | ({ kind: 'browser-bind'; username: string } & WithPretty)
  | ({ kind: 'feed-for-you' | 'feed-following'; limit: number } & WithPretty)
  | ({ kind: 'timeline-home' | 'timeline-following'; limit: number } & WithPretty)
  | ({ kind: 'search-posts'; query: string; limit: number } & WithPretty)
  | ({ kind: 'post-get'; postId: string } & WithPretty)
  | ({ kind: 'post-delete'; postId: string } & WithPretty)
  | ({ kind: 'user-get'; username: string } & WithPretty)
  | ({ kind: 'following-check'; username: string } & WithPretty)
  | ({ kind: 'post-create'; text: string } & WithPretty)
  | ({ kind: 'reply'; postId: string; text: string } & WithPretty)
  | ({ kind: 'like' | 'unlike'; postId: string } & WithPretty)
  | ({ kind: 'follow' | 'unfollow'; username: string } & WithPretty)
  | ({ kind: 'bookmark-list' | 'dm-list'; limit: number } & WithPretty)
  | ({ kind: 'bookmark-add' | 'bookmark-remove'; postId: string } & WithPretty)
  | ({ kind: 'dm-read'; username: string; limit: number } & WithPretty)
  | ({ kind: 'dm-send'; username: string; text: string } & WithPretty)
  | ({ kind: 'bulk-plan'; inputPath: string } & WithPretty)
  | ({ kind: 'bulk-execute'; actionId: string } & WithPretty)
  | ({ kind: 'action-execute'; actionId: string } & WithPretty);

export function parseArgs(argv: readonly string[]): ParsedCommand {
  const { positional, options } = split(argv);
  const pretty = takeBoolean(options, 'pretty');
  const command = positional.join(' ');
  let result: ParsedCommand;
  if (command === 'auth login' || command === 'auth status' || command === 'auth logout' || command === 'me') {
    result = { kind: command.replace(' ', '-') as ParsedCommand['kind'], pretty } as ParsedCommand;
  } else if (command === 'browser status') {
    result = { kind: 'browser-status', pretty };
  } else if (positional[0] === 'browser' && positional[1] === 'bind' && positional.length === 3) {
    result = { kind: 'browser-bind', username: normalizeUsername(positional[2]!), pretty };
  } else if (positional[0] === 'feed' && ['for-you', 'following'].includes(positional[1] ?? '') && positional.length === 2) {
    result = { kind: `feed-${positional[1]}` as 'feed-for-you' | 'feed-following', limit: takeLimit(options), pretty };
  } else if (positional[0] === 'timeline' && ['home', 'following'].includes(positional[1] ?? '') && positional.length === 2) {
    result = { kind: `timeline-${positional[1]}` as 'timeline-home' | 'timeline-following', limit: takeLimit(options), pretty };
  } else if (positional[0] === 'search' && positional[1] === 'posts' && positional.length === 3) {
    result = { kind: 'search-posts', query: positional[2]!, limit: takeLimit(options), pretty };
  } else if (positional[0] === 'post' && positional[1] === 'get' && positional.length === 3) {
    result = { kind: 'post-get', postId: parsePostRef(positional[2]!), pretty };
  } else if (positional[0] === 'post' && positional[1] === 'delete' && positional.length === 3) {
    result = { kind: 'post-delete', postId: parsePostRef(positional[2]!), pretty };
  } else if (positional[0] === 'user' && positional[1] === 'get' && positional.length === 3) {
    result = { kind: 'user-get', username: normalizeUsername(positional[2]!), pretty };
  } else if (positional[0] === 'following' && positional[1] === 'check' && positional.length === 3) {
    result = { kind: 'following-check', username: normalizeUsername(positional[2]!), pretty };
  } else if (positional[0] === 'post' && positional[1] === 'create' && positional.length === 2) {
    result = { kind: 'post-create', text: takeText(options), pretty };
  } else if (positional[0] === 'reply' && positional.length === 2) {
    result = { kind: 'reply', postId: parsePostRef(positional[1]!), text: takeText(options), pretty };
  } else if (['like', 'unlike'].includes(positional[0] ?? '') && positional.length === 2) {
    result = { kind: positional[0] as 'like' | 'unlike', postId: parsePostRef(positional[1]!), pretty };
  } else if (['follow', 'unfollow'].includes(positional[0] ?? '') && positional.length === 2) {
    result = { kind: positional[0] as 'follow' | 'unfollow', username: normalizeUsername(positional[1]!), pretty };
  } else if (command === 'bookmark list') {
    result = { kind: 'bookmark-list', limit: takeLimit(options), pretty };
  } else if (positional[0] === 'bookmark' && ['add', 'remove'].includes(positional[1] ?? '') && positional.length === 3) {
    result = { kind: `bookmark-${positional[1]}` as 'bookmark-add' | 'bookmark-remove', postId: parsePostRef(positional[2]!), pretty };
  } else if (command === 'dm list') {
    result = { kind: 'dm-list', limit: takeLimit(options), pretty };
  } else if (positional[0] === 'dm' && positional[1] === 'read' && positional.length === 3) {
    result = { kind: 'dm-read', username: normalizeUsername(positional[2]!), limit: takeLimit(options), pretty };
  } else if (positional[0] === 'dm' && positional[1] === 'send' && positional.length === 3) {
    result = { kind: 'dm-send', username: normalizeUsername(positional[2]!), text: takeText(options), pretty };
  } else if (command === 'bulk plan') {
    result = { kind: 'bulk-plan', inputPath: takeInputPath(options), pretty };
  } else if (positional[0] === 'bulk' && positional[1] === 'execute' && positional.length === 3) {
    result = { kind: 'bulk-execute', actionId: positional[2]!, pretty };
  } else if (positional[0] === 'action' && positional[1] === 'execute' && positional.length === 3) {
    result = { kind: 'action-execute', actionId: positional[2]!, pretty };
  } else {
    throw new XCliError('INVALID_INPUT', `Unknown command: ${command || '(empty)'}`);
  }
  const unknown = options.keys().next().value as string | undefined;
  if (unknown !== undefined) throw new XCliError('INVALID_INPUT', `Unknown option: --${unknown}`);
  return result;
}

function split(argv: readonly string[]): { positional: string[]; options: Map<string, string | true> } {
  const positional: string[] = [];
  const options = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (!value.startsWith('--')) { positional.push(value); continue; }
    const name = value.slice(2);
    if (name === 'pretty' || !['limit', 'text', 'input'].includes(name)) { options.set(name, true); continue; }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) throw new XCliError('INVALID_INPUT', `Missing value for --${name}`);
    options.set(name, next);
    index += 1;
  }
  return { positional, options };
}

function takeBoolean(options: Map<string, string | true>, name: string): boolean {
  const value = options.get(name);
  options.delete(name);
  return value === true;
}

function takeLimit(options: Map<string, string | true>): number {
  const value = options.get('limit');
  options.delete('limit');
  if (value === undefined) return 20;
  const limit = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new XCliError('INVALID_INPUT', '--limit must be between 1 and 100');
  return limit;
}

function takeText(options: Map<string, string | true>): string {
  const value = options.get('text');
  options.delete('text');
  if (typeof value !== 'string' || value.trim() === '') throw new XCliError('INVALID_INPUT', 'Post text is required');
  if (Array.from(value).length > 280) throw new XCliError('INVALID_INPUT', 'Post text must be at most 280 characters');
  return value;
}

function takeInputPath(options: Map<string, string | true>): string {
  const value = options.get('input');
  options.delete('input');
  if (typeof value !== 'string' || value.trim() === '') throw new XCliError('INVALID_INPUT', 'Bulk input file is required');
  return value;
}
