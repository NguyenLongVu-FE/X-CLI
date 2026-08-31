import { createHash, randomBytes } from 'node:crypto';

export interface PkceValues {
  verifier: string;
  challenge: string;
  state: string;
}

export function createPkce(): PkceValues {
  const verifier = randomBytes(48).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    state: randomBytes(24).toString('base64url')
  };
}
