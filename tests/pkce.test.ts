import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createPkce } from '../src/auth/pkce.js';

describe('OAuth PKCE', () => {
  it('creates a verifier and matching SHA-256 URL-safe challenge', () => {
    const value = createPkce();
    const expected = createHash('sha256').update(value.verifier).digest('base64url');
    expect(value.challenge).toBe(expected);
    expect(value.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(value.state.length).toBeGreaterThanOrEqual(32);
  });

  it('does not reuse state', () => {
    expect(createPkce().state).not.toBe(createPkce().state);
  });
});
