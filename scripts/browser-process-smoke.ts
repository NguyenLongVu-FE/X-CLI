import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), 'x-cli-browser-process-'));

try {
  const bin = join(root, 'bin');
  const support = join(root, 'Library', 'Application Support', 'x-cli');
  await Promise.all([mkdir(bin), mkdir(support, { recursive: true })]);
  const fake = join(bin, 'playwriter');
  await writeFile(fake, `#!/bin/sh
if [ "$1" = "browser" ] && [ "$2" = "list" ]; then
  printf 'KEY  TYPE  BROWSER  PROFILE\ninstall:Chrome:test  extension  Chrome  test@example.com\n'
elif [ "$1" = "session" ] && [ "$2" = "new" ]; then
  printf 'smoke-session\n'
elif [ "$1" = "session" ] && [ "$2" = "delete" ]; then
  exit 0
else
  printf '[log] __XCLI_RESULT__{"url":"https://x.com/home","profileHref":"/imtamhn","displayName":"Tam","snapshot":"authenticated"}\n'
fi
`);
  await chmod(fake, 0o755);
  await writeFile(join(support, 'browser.json'), '{"expectedUsername":"imtamhn","browserKey":"install:Chrome:test"}\n', { mode: 0o600 });
  const env = { ...process.env, HOME: root, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` };
  const executable = join(process.cwd(), 'dist', 'cli.js');
  const listed = await exec(executable, ['browser', 'list'], { env });
  assert.match(listed.stdout, /"key":"install:Chrome:test"/);
  const status = await exec(executable, ['browser', 'status'], { env });
  assert.deepEqual(JSON.parse(status.stdout), { connected: true, authenticated: true, username: 'imtamhn' });
  process.stdout.write('browser process smoke passed\n');
} finally {
  await rm(root, { recursive: true, force: true });
}
