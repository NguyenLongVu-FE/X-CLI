import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PlaywriterRunner } from '../src/browser/runner.js';
import type { ExecFileLike } from '../src/browser/process.js';

function lifecycle(output = '__XCLI_RESULT__{"username":"imtamhn"}\n'): {
  execFile: ExecFileLike;
  activeSessions: Set<string>;
  calls: { file: string; args: readonly string[]; shell?: boolean; timeout?: number }[];
} {
  const activeSessions = new Set<string>();
  const calls: { file: string; args: readonly string[]; shell?: boolean; timeout?: number }[] = [];
  const execFile: ExecFileLike = async (file, args, options) => {
    calls.push({ file, args, shell: options.shell, timeout: options.timeout });
    if (args[0] === 'session' && args[1] === 'new') {
      activeSessions.add('17');
      return { stdout: '17\n', stderr: '' };
    }
    if (args[0] === 'session' && args[1] === 'delete') {
      activeSessions.delete(args[2]!);
      return { stdout: '', stderr: '' };
    }
    return { stdout: output, stderr: '' };
  };
  return { execFile, activeSessions, calls };
}

describe('Playwriter runner', () => {
  it('uses the audited repository Playwriter when no global command is installed', async () => {
    const fake = lifecycle('KEY  TYPE  BROWSER  PROFILE\ninstall:Chrome:test  extension  Chrome  test@example.com\n');
    const runner = new PlaywriterRunner({ execFile: fake.execFile, withLock: async (work) => work() });

    await runner.listBrowsers();

    expect(fake.calls[0]?.file).toBe(fileURLToPath(new URL('../node_modules/.bin/playwriter', import.meta.url)));
  });

  it('uses the real X program when production options are omitted', async () => {
    const fake = lifecycle();
    const runner = new PlaywriterRunner({ execFile: fake.execFile, withLock: async (work) => work() });

    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' }, 'install:Chrome:abc')).resolves.toEqual({ username: 'imtamhn' });
    const evaluation = fake.calls.find(({ args }) => args[0] === '-s');
    expect(evaluation?.args.at(-1)).toContain('__XCLI_RESULT__');
  });

  it('returns marked JSON and deletes the isolated session', async () => {
    const fake = lifecycle();
    const runner = new PlaywriterRunner({ execFile: fake.execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' }, 'install:Chrome:abc')).resolves.toEqual({ username: 'imtamhn' });
    expect(fake.activeSessions.size).toBe(0);
    expect(fake.calls.map(({ args }) => args.slice(0, 2))).toEqual([['session', 'new'], ['-s', '17'], ['session', 'delete']]);
    expect(fake.calls[0]!.args).toEqual(['session', 'new', '--browser', 'install:Chrome:abc']);
    expect(fake.calls.every(({ shell }) => shell === false)).toBe(true);
    expect(fake.calls.every(({ timeout }) => timeout === 90_000)).toBe(true);
  });

  it('accepts the verbose session output emitted by Playwriter 0.4.0', async () => {
    const fake = lifecycle();
    const original = fake.execFile;
    fake.execFile = async (file, args, options) => {
      if (args[0] === 'session' && args[1] === 'new') {
        fake.activeSessions.add('17');
        return { stdout: 'CDP relay server started successfully\nSession 17 created. Use with: playwriter -s 17 -e "..."\n', stderr: '' };
      }
      return original(file, args, options);
    };
    const runner = new PlaywriterRunner({ execFile: fake.execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' }, 'install:Chrome:abc')).resolves.toEqual({ username: 'imtamhn' });
    expect(fake.activeSessions.size).toBe(0);
  });

  it('deletes the session when browser output is malformed', async () => {
    const fake = lifecycle('ordinary diagnostic\n');
    const runner = new PlaywriterRunner({ execFile: fake.execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' }, 'install:Chrome:abc')).rejects.toMatchObject({ code: 'X_UI_CHANGED' });
    expect(fake.activeSessions.size).toBe(0);
  });

  it('maps a missing Playwriter executable without exposing process output', async () => {
    const execFile: ExecFileLike = async () => { throw Object.assign(new Error('secret process output'), { code: 'ENOENT' }); };
    const runner = new PlaywriterRunner({ execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' }, 'install:Chrome:abc')).rejects.toMatchObject({
      code: 'PLAYWRITER_UNAVAILABLE', message: 'Playwriter executable is not available'
    });
  });

  it('maps a disconnected extension and still deletes the session', async () => {
    const fake = lifecycle();
    fake.execFile = async (file, args, options) => {
      if (args[0] === '-s') throw Object.assign(new Error('no browser tabs have Playwriter enabled'), { stderr: 'no browser tabs have Playwriter enabled' });
      return lifecycleStep(fake, file, args, options);
    };
    const runner = new PlaywriterRunner({ execFile: fake.execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' }, 'install:Chrome:abc')).rejects.toMatchObject({ code: 'BROWSER_DISCONNECTED' });
    expect(fake.activeSessions.size).toBe(0);
  });

  it('lists every browser without creating a session', async () => {
    const output = `Waiting for extension to connect...
KEY                            TYPE       BROWSER            PROFILE
---------------------------------------------------------------------------
install:Chrome:abc             extension  Chrome             itstamhn@gmail.com
headless                       headless   Chrome (Headless)  -

Use with: playwriter session new [--browser <key>]
`;
    const calls: string[][] = [];
    const execFile: ExecFileLike = async (_file, args) => { calls.push([...args]); return { stdout: output, stderr: '' }; };
    const runner = new PlaywriterRunner({ execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.listBrowsers()).resolves.toEqual([
      { key: 'install:Chrome:abc', type: 'extension', browser: 'Chrome', profile: 'itstamhn@gmail.com' },
      { key: 'headless', type: 'headless', browser: 'Chrome (Headless)', profile: '-' }
    ]);
    expect(calls).toEqual([['browser', 'list']]);
  });
});

async function lifecycleStep(
  fake: ReturnType<typeof lifecycle>,
  file: string,
  args: readonly string[],
  options: { timeout: number; shell: false }
): Promise<{ stdout: string; stderr: string }> {
  fake.calls.push({ file, args, shell: options.shell, timeout: options.timeout });
  if (args[0] === 'session' && args[1] === 'new') { fake.activeSessions.add('17'); return { stdout: '17\n', stderr: '' }; }
  if (args[0] === 'session' && args[1] === 'delete') { fake.activeSessions.delete(args[2]!); return { stdout: '', stderr: '' }; }
  return { stdout: '', stderr: '' };
}
