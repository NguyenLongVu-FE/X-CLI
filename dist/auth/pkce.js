import { createHash, randomBytes } from 'node:crypto';
export function createPkce() {
    const verifier = randomBytes(48).toString('base64url');
    return {
        verifier,
        challenge: createHash('sha256').update(verifier).digest('base64url'),
        state: randomBytes(24).toString('base64url')
    };
}
