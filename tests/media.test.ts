import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { describeMedia, verifyMedia } from '../src/media.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('media integrity', () => {
  it('describes files with an absolute path, size, and streaming SHA-256 only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'x-media-')); roots.push(root);
    const path = join(root, 'image.png');
    await writeFile(path, Buffer.from('abc'));

    await expect(describeMedia([path])).resolves.toEqual([{
      path: resolve(path), size: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    }]);
    expect(Object.keys((await describeMedia([path]))[0]!)).toEqual(['path', 'size', 'sha256']);
  });

  it('rejects unreadable or missing paths before a preview is created', async () => {
    await expect(describeMedia(['/definitely/missing/x-cli-media.png'])).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('detects file replacement after approval', async () => {
    const root = await mkdtemp(join(tmpdir(), 'x-media-')); roots.push(root);
    const path = join(root, 'image.png');
    await writeFile(path, Buffer.from('abc'));
    const descriptors = await describeMedia([path]);
    await writeFile(path, Buffer.from('xyz'));

    await expect(verifyMedia(descriptors)).rejects.toMatchObject({ code: 'ACTION_TAMPERED' });
  });
});
