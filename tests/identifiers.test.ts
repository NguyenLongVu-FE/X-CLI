import { describe, expect, it } from 'vitest';

import { normalizeUsername, parsePostRef } from '../src/identifiers.js';

describe('X identifiers', () => {
  it('accepts a numeric post ID or an X status URL', () => {
    expect(parsePostRef('123456')).toBe('123456');
    expect(parsePostRef('https://x.com/tam/status/123456?s=20')).toBe('123456');
    expect(parsePostRef('https://twitter.com/tam/status/987')).toBe('987');
  });

  it('rejects foreign URLs and non-numeric IDs', () => {
    expect(() => parsePostRef('https://example.com/status/123')).toThrow('Invalid X post reference');
    expect(() => parsePostRef('abc')).toThrow('Invalid X post reference');
  });

  it('normalizes valid usernames and rejects invalid ones', () => {
    expect(normalizeUsername('@imtamhn')).toBe('imtamhn');
    expect(() => normalizeUsername('bad name')).toThrow('Invalid X username');
    expect(() => normalizeUsername('a'.repeat(16))).toThrow('Invalid X username');
  });
});
