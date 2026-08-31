import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

try {
  await exec('git', ['check-ignore', 'dist/cli.js']);
  throw new Error('dist/cli.js is ignored; GitHub installs cannot use the built CLI');
} catch (error) {
  if (error instanceof Error && error.message.startsWith('dist/cli.js is ignored')) throw error;
}

const { stdout } = await exec('git', ['status', '--porcelain', '--', 'dist']);
const uncommittedBuildOutput = stdout.split('\n').filter((line) => line !== '' && (line.startsWith('??') || line[1] !== ' '));
if (uncommittedBuildOutput.length > 0) {
  throw new Error(`generated dist differs from the staged or committed build:\n${uncommittedBuildOutput.join('\n')}`);
}
process.stdout.write('dist smoke passed\n');
