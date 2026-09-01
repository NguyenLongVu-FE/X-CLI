import { describe, expect, it } from 'vitest';

import { PlaywriterRunner } from '../src/browser/runner.js';
import type { ExecFileLike } from '../src/browser/process.js';

function lifecycle(output = '__XCLI_RESULT__{"username":"imtamhn"}\n'): {
  execFile: ExecFileLike;
  activeSessions: Set<string>;
  calls: { file: string; args: readonly string[]; shell?: boolean }[];
} {
  const activeSessions = new Set<string>();
  const calls: { file: string; args: readonly string[]; shell?: boolean }[] = [];
  const execFile: ExecFileLike = async (file, args, options) => {
    calls.push({ file, args, shell: options.shell });
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
  it('returns marked JSON and deletes the isolated session', async () => {
    const fake = lifecycle();
    const runner = new PlaywriterRunner({ execFile: fake.execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' })).resolves.toEqual({ username: 'imtamhn' });
    expect(fake.activeSessions.size).toBe(0);
    expect(fake.calls.map(({ args }) => args.slice(0, 2))).toEqual([['session', 'new'], ['-s', '17'], ['session', 'delete']]);
    expect(fake.calls.every(({ shell }) => shell === false)).toBe(true);
  });

  it('deletes the session when browser output is malformed', async () => {
    const fake = lifecycle('ordinary diagnostic\n');
    const runner = new PlaywriterRunner({ execFile: fake.execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' })).rejects.toMatchObject({ code: 'X_UI_CHANGED' });
    expect(fake.activeSessions.size).toBe(0);
  });

  it('maps a missing Playwriter executable without exposing process output', async () => {
    const execFile: ExecFileLike = async () => { throw Object.assign(new Error('secret process output'), { code: 'ENOENT' }); };
    const runner = new PlaywriterRunner({ execFile, buildProgram: () => 'program', withLock: async (work) => work() });
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' })).rejects.toMatchObject({
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
    await expect(runner.run({ kind: 'status', expectedUsername: 'imtamhn' })).rejects.toMatchObject({ code: 'BROWSER_DISCONNECTED' });
    expect(fake.activeSessions.size).toBe(0);
  });
});

async function lifecycleStep(
  fake: ReturnType<typeof lifecycle>,
  file: string,
  args: readonly string[],
  options: { timeout: number; shell: false }
): Promise<{ stdout: string; stderr: string }> {
  fake.calls.push({ file, args, shell: options.shell });
  if (args[0] === 'session' && args[1] === 'new') { fake.activeSessions.add('17'); return { stdout: '17\n', stderr: '' }; }
  if (args[0] === 'session' && args[1] === 'delete') { fake.activeSessions.delete(args[2]!); return { stdout: '', stderr: '' }; }
  return { stdout: '', stderr: '' };
}
