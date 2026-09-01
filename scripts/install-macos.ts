import { constants } from 'node:fs';
import { access, lstat, mkdir, rename, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'dist', 'cli.js');
const binDirectory = process.env.XCLI_BIN_DIR ?? join(homedir(), '.local', 'bin');
const destination = join(binDirectory, 'x');
const temporary = join(binDirectory, `.x.${process.pid}.tmp`);

await access(target, constants.X_OK);
await mkdir(binDirectory, { recursive: true, mode: 0o700 });
const existing = await lstat(destination).catch((error: unknown) => {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
  throw error;
});
if (existing !== null && !existing.isSymbolicLink()) throw new Error(`Refusing to replace non-symlink: ${destination}`);

try {
  await symlink(target, temporary);
  await rename(temporary, destination);
} finally {
  await unlink(temporary).catch(() => undefined);
}

process.stdout.write(`Installed x -> ${target}\nAdd ${binDirectory} to PATH if x is not found.\n`);
