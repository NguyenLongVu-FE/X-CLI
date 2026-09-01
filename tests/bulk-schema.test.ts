import { describe, expect, it } from 'vitest';

import { BulkInputSchema } from '../src/bulk/schema.js';

const like = { kind: 'like', postId: '123' } as const;

describe('bulk input schema', () => {
  it('accepts only an explicit, bounded list for one account', () => {
    expect(BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: [like] })).toEqual({
      version: 1, account: 'imtamhn', actions: [like]
    });
    expect(() => BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: Array(21).fill(like) })).toThrow();
  });

  it('rejects unknown fields, nested bulk, missing targets, and duplicate canonical actions', () => {
    expect(() => BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: [{ ...like, surprise: true }] })).toThrow();
    expect(() => BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: [{ kind: 'bulk', actions: [] }] })).toThrow();
    expect(() => BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: [{ kind: 'like' }] })).toThrow();
    expect(() => BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: [like, { postId: '123', kind: 'like' }] })).toThrow();
    expect(() => BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: [
      { kind: 'follow', username: '@Sabrina' }, { kind: 'follow', username: 'sabrina' }
    ] })).toThrow();
  });
});
