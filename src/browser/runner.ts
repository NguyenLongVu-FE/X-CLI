import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { XCliError } from '../errors.js';
import { BrowserLock } from './lock.js';
import { systemExecFile, type ExecFileLike } from './process.js';
import type { BrowserDescriptor, BrowserOperation } from './types.js';
import { buildXProgram } from './x-program.js';

const RESULT_PREFIX = '__XCLI_RESULT__';
const BUNDLED_PLAYWRITER = fileURLToPath(new URL('../../node_modules/.bin/playwriter', import.meta.url));

interface PlaywriterRunnerOptions {
  execFile?: ExecFileLike;
  buildProgram?: (operation: BrowserOperation) => string;
  timeoutMs?: number;
  binary?: string;
  withLock?: <T>(work: () => Promise<T>) => Promise<T>;
}

export class PlaywriterRunner {
  private readonly execFile: ExecFileLike;
  private readonly timeoutMs: number;
  private readonly binary: string;
  private readonly buildProgram: (operation: BrowserOperation) => string;
  private readonly withLock: <T>(work: () => Promise<T>) => Promise<T>;

  constructor(options: PlaywriterRunnerOptions = {}) {
    this.execFile = options.execFile ?? systemExecFile;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.binary = options.binary ?? BUNDLED_PLAYWRITER;
    this.buildProgram = options.buildProgram ?? buildXProgram;
    const lock = new BrowserLock(join(homedir(), 'Library', 'Application Support', 'x-cli', 'browser.lock'));
    this.withLock = options.withLock ?? ((work) => lock.withLock(work));
  }

  async listBrowsers(): Promise<BrowserDescriptor[]> {
    const result = await this.call(['browser', 'list']);
    const browsers = parseBrowserList(result.stdout);
    if (browsers.length === 0) throw new XCliError('BROWSER_DISCONNECTED', 'Playwriter did not report an available browser', 2);
    return browsers;
  }

  run<T>(operation: BrowserOperation, browserKey: string): Promise<T> {
    return this.withLock(async () => this.runInSession<T>(operation, browserKey));
  }

  private async runInSession<T>(operation: BrowserOperation, browserKey: string): Promise<T> {
    let sessionId: string | undefined;
    try {
      const created = await this.call(['session', 'new', '--browser', browserKey]);
      sessionId = parseSessionId(created.stdout);
      const result = await this.call(['-s', sessionId, '--timeout', String(this.timeoutMs), '-e', this.buildProgram(operation)]);
      return parseMarkedJson<T>(result.stdout);
    } finally {
      if (sessionId !== undefined) await this.call(['session', 'delete', sessionId]).catch(() => undefined);
    }
  }

  private async call(args: readonly string[]) {
    try {
      return await this.execFile(this.binary, args, { timeout: this.timeoutMs, shell: false });
    } catch (error) {
      if (hasCode(error, 'ENOENT')) throw new XCliError('PLAYWRITER_UNAVAILABLE', 'Playwriter executable is not available', 2);
      const diagnostic = processDiagnostic(error);
      if (/extension is not connected|no browser tabs have Playwriter enabled|browser connection/i.test(diagnostic)) {
        throw new XCliError('BROWSER_DISCONNECTED', 'Playwriter is not connected to a Chrome tab', 2);
      }
      throw new XCliError('BROWSER_DISCONNECTED', 'Playwriter browser command failed', 2);
    }
  }
}

function parseBrowserList(stdout: string): BrowserDescriptor[] {
  return stdout.split(/\r?\n/).flatMap((line) => {
    const columns = line.trim().split(/\s{2,}/);
    if (columns.length !== 4 || columns[0] === 'KEY') return [];
    return [{ key: columns[0]!, type: columns[1]!, browser: columns[2]!, profile: columns[3]! }];
  });
}

function parseSessionId(stdout: string): string {
  const trimmed = stdout.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  const matches = [...stdout.matchAll(/^Session ([A-Za-z0-9_-]+) created\./gm)];
  if (matches.length === 1) return matches[0]![1]!;
  throw new XCliError('BROWSER_DISCONNECTED', 'Playwriter returned an invalid session identifier', 2);
}

export function parseMarkedJson<T>(stdout: string): T {
  const marked = stdout.split(/\r?\n/).flatMap((line) => {
    const match = line.match(new RegExp(`^(?:\\[log\\]\\s+)?${RESULT_PREFIX}(.*)$`));
    return match === null ? [] : [match[1]!];
  });
  if (marked.length !== 1) throw new XCliError('X_UI_CHANGED', 'Playwriter did not return exactly one X-CLI result', 2);
  try { return JSON.parse(marked[0]!) as T; }
  catch { throw new XCliError('X_UI_CHANGED', 'Playwriter returned an invalid X-CLI result', 2); }
}

export function redactDiagnostic(_value: string): string {
  return '[redacted sensitive browser diagnostic]';
}

function processDiagnostic(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';
  const value = error as { message?: unknown; stderr?: unknown };
  return `${typeof value.message === 'string' ? value.message : ''}\n${typeof value.stderr === 'string' ? value.stderr : ''}`;
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
