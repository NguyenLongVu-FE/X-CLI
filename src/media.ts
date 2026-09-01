import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { XCliError } from './errors.js';

export interface MediaDescriptor {
  path: string;
  size: number;
  sha256: string;
}

export async function describeMedia(paths: readonly string[]): Promise<MediaDescriptor[]> {
  return Promise.all(paths.map(async (input) => {
    const path = resolve(input);
    try {
      const metadata = await stat(path);
      if (!metadata.isFile()) throw new Error('not a regular file');
      return { path, size: metadata.size, sha256: await sha256File(path) };
    } catch {
      throw new XCliError('INVALID_INPUT', `Media file is missing or unreadable: ${input}`, 2);
    }
  }));
}

export async function verifyMedia(descriptors: readonly MediaDescriptor[]): Promise<void> {
  for (const descriptor of descriptors) {
    try {
      const metadata = await stat(descriptor.path);
      const hash = await sha256File(descriptor.path);
      if (!metadata.isFile() || metadata.size !== descriptor.size || hash !== descriptor.sha256) throw new Error('changed');
    } catch {
      throw new XCliError('ACTION_TAMPERED', 'Approved media is missing or has changed', 2);
    }
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}
