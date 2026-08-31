import { request } from 'node:http';
import { describe, expect, it } from 'vitest';

import { receiveOAuthCallback } from '../src/auth/callback.js';

describe('OAuth loopback callback', () => {
  it('accepts one callback on loopback and returns code and state', async () => {
    const pending = receiveOAuthCallback({ port: 18787, timeoutMs: 2_000 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await new Promise<void>((resolve, reject) => {
      request('http://127.0.0.1:18787/callback?code=abc&state=state', (response) => {
        response.resume(); response.on('end', resolve);
      }).on('error', reject).end();
    });
    await expect(pending).resolves.toEqual({ code: 'abc', state: 'state' });
  });
});
