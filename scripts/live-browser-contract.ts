import { spawn } from 'node:child_process';

type Check = { command: string; status: 'pass'; records: number };

if (process.env.X_LIVE_BROWSER !== '1') throw new Error('Set X_LIVE_BROWSER=1 to run authorized live browser checks');
const executable = process.env.X_CLI_BIN ?? 'x';
const username = process.env.X_LIVE_USERNAME ?? 'imtamhn';
const dmUsername = process.env.X_LIVE_DM_USERNAME;
if (dmUsername === undefined) throw new Error('Set X_LIVE_DM_USERNAME to an explicitly approved DM conversation');
const checks: Check[] = [];

async function run(args: string[]): Promise<unknown[]> {
  const { stdout, stderr, exitCode } = await execute(executable, args);
  if (exitCode !== 0) throw new Error(`${args.join(' ')} failed: ${redact(stderr)}`);
  const records = stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line) as unknown);
  checks.push({ command: args.join(' '), status: 'pass', records: records.length });
  return records;
}

await run(['browser', 'status']);
const [me] = await run(['me']);
if (!isRecord(me) || me.username !== username) throw new Error(`Bound account is not @${username}`);
const feed = await run(['feed', 'for-you', '--limit', '2']);
await run(['feed', 'following', '--limit', '2']);
const search = await run(['search', 'posts', `from:${username}`, '--limit', '2']);
await run(['user', 'get', username]);
await run(['bookmark', 'list', '--limit', '2']);
await run(['dm', 'list', '--limit', '2']);
await run(['dm', 'read', dmUsername, '--limit', '2']);
const candidate = search[0] ?? feed[0];
if (!isRecord(candidate) || typeof candidate.id !== 'string') throw new Error('No visible post is available for post get verification');
await run(['post', 'get', candidate.id]);

process.stdout.write(`${JSON.stringify({ account: `@${username}`, checks })}\n`);

function execute(file: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function redact(value: string): string { return value.replace(/"text"\s*:\s*"[^"]*"/gi, '"text":"[REDACTED]"').trim(); }
