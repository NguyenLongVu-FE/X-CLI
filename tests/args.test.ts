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

  it('rejects unsafe or ambiguous input', () => {
    expect(() => parseArgs(['timeline', 'home', '--limit', '0'])).toThrow('between 1 and 100');
    expect(() => parseArgs(['me', '--unknown'])).toThrow('Unknown option');
    expect(() => parseArgs(['post', 'create', '--text', ''])).toThrow('Post text is required');
    expect(() => parseArgs(['post', 'create', '--text', 'x'.repeat(281)])).toThrow('at most 280');
  });

  it('parses every first-release write action', () => {
    expect(parseArgs(['like', '123']).kind).toBe('like');
    expect(parseArgs(['unlike', '123']).kind).toBe('unlike');
    expect(parseArgs(['follow', '@imtamhn']).kind).toBe('follow');
    expect(parseArgs(['unfollow', 'imtamhn']).kind).toBe('unfollow');
    expect(parseArgs(['action', 'execute', 'act_123'])).toEqual({ kind: 'action-execute', actionId: 'act_123', pretty: false });
  });
});
