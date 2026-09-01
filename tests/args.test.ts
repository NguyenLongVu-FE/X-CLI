import { describe, expect, it } from 'vitest';

import { parseArgs } from '../src/args.js';

describe('command parsing', () => {
  it('parses a limited home timeline read', () => {
    expect(parseArgs(['timeline', 'home', '--limit', '20'])).toEqual({ kind: 'timeline-home', limit: 20, pretty: false });
  });

  it('parses reply text without executing it', () => {
    expect(parseArgs(['reply', 'https://x.com/t/status/123', '--text', 'Thanks'])).toEqual({
      kind: 'reply', postId: '123', text: 'Thanks', pretty: false
    });
  });

  it('keeps repeated media paths in their explicit order', () => {
    expect(parseArgs(['post', 'create', '--text', 'hi', '--media', 'a.png', '--media', 'b.jpg'])).toMatchObject({
      kind: 'post-create', media: ['a.png', 'b.jpg']
    });
    expect(parseArgs(['reply', '123', '--text', 'hi', '--media', 'a.png'])).toMatchObject({ media: ['a.png'] });
    expect(parseArgs(['dm', 'send', '@sabrina', '--text', 'hi', '--media', 'a.png'])).toMatchObject({ media: ['a.png'] });
    expect(() => parseArgs(['dm', 'send', '@sabrina', '--text', 'hi', '--media', 'a.png', '--media', 'b.jpg'])).toThrow('at most one media');
  });

  it('rejects unsafe or ambiguous input', () => {
    expect(() => parseArgs(['timeline', 'home', '--limit', '0'])).toThrow('between 1 and 100');
    expect(() => parseArgs(['me', '--unknown'])).toThrow('Unknown option');
    expect(() => parseArgs(['post', 'create', '--text', ''])).toThrow('Post text is required');
    expect(() => parseArgs(['post', 'create', '--text', 'x'.repeat(281)])).toThrow('at most 280');
  });

  it('parses every first-release write action', () => {
    expect(parseArgs(['post', 'delete', 'https://x.com/t/status/123'])).toEqual({ kind: 'post-delete', postId: '123', pretty: false });
    expect(parseArgs(['like', '123']).kind).toBe('like');
    expect(parseArgs(['unlike', '123']).kind).toBe('unlike');
    expect(parseArgs(['follow', '@imtamhn']).kind).toBe('follow');
    expect(parseArgs(['unfollow', 'imtamhn']).kind).toBe('unfollow');
    expect(parseArgs(['action', 'execute', 'act_123'])).toEqual({ kind: 'action-execute', actionId: 'act_123', pretty: false });
  });

  it('parses a following relationship check without creating an action', () => {
    expect(parseArgs(['following', 'check', '@imtamhn'])).toEqual({ kind: 'following-check', username: 'imtamhn', pretty: false });
  });

  it('parses browser binding and both real web feeds', () => {
    expect(parseArgs(['browser', 'list'])).toEqual({ kind: 'browser-list', pretty: false });
    expect(parseArgs(['browser', 'bind', '@imtamhn', '--browser', 'install:Chrome:abc'])).toEqual({
      kind: 'browser-bind', username: 'imtamhn', browserKey: 'install:Chrome:abc', pretty: false
    });
    expect(parseArgs(['browser', 'status'])).toEqual({ kind: 'browser-status', pretty: false });
    expect(parseArgs(['feed', 'for-you', '--limit', '5'])).toEqual({ kind: 'feed-for-you', limit: 5, pretty: false });
    expect(parseArgs(['feed', 'following'])).toEqual({ kind: 'feed-following', limit: 20, pretty: false });
    expect(() => parseArgs(['browser', 'bind', '@imtamhn'])).toThrow('Browser key is required');
  });

  it('parses bookmark and direct-message commands without sending them', () => {
    expect(parseArgs(['bookmark', 'list', '--limit', '3'])).toEqual({ kind: 'bookmark-list', limit: 3, pretty: false });
    expect(parseArgs(['bookmark', 'add', 'https://x.com/t/status/123'])).toEqual({ kind: 'bookmark-add', postId: '123', pretty: false });
    expect(parseArgs(['bookmark', 'remove', '123'])).toEqual({ kind: 'bookmark-remove', postId: '123', pretty: false });
    expect(parseArgs(['dm', 'list'])).toEqual({ kind: 'dm-list', limit: 20, pretty: false });
    expect(parseArgs(['dm', 'read', '@sabrina', '--limit', '4'])).toEqual({ kind: 'dm-read', username: 'sabrina', limit: 4, pretty: false });
    expect(parseArgs(['dm', 'send', '@sabrina', '--text', 'Approved text'])).toEqual({
      kind: 'dm-send', username: 'sabrina', text: 'Approved text', pretty: false
    });
  });

  it('parses explicit bulk planning and execution', () => {
    expect(parseArgs(['bulk', 'plan', '--input', './actions.json'])).toEqual({ kind: 'bulk-plan', inputPath: './actions.json', pretty: false });
    expect(parseArgs(['bulk', 'execute', 'act_123'])).toEqual({ kind: 'bulk-execute', actionId: 'act_123', pretty: false });
    expect(() => parseArgs(['bulk', 'plan'])).toThrow('Bulk input file is required');
  });
});
