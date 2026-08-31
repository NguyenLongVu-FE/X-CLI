import { spawn } from 'node:child_process';
import { z } from 'zod';

import type { CredentialStore, OAuthTokens } from './credentials.js';
import { XCliError } from '../errors.js';

const SERVICE = 'com.nguyenlongvu.x-cli';
const ACCOUNT = 'oauth-tokens';
const tokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().finite(),
  scope: z.array(z.string())
});

export type CommandResult = { stdout: string; stderr: string; exitCode: number };
export type CommandRunner = (file: string, args: readonly string[], input?: string) => Promise<CommandResult>;

export class MacOsKeychainStore implements CredentialStore {
  constructor(private readonly run: CommandRunner = runCommand) {}

  async get(): Promise<OAuthTokens | null> {
    const result = await this.run('/usr/bin/security', ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w']);
    if (result.exitCode === 44) return null;
    if (result.exitCode !== 0) throw keychainError('read');
    const parsed = tokenSchema.safeParse(JSON.parse(result.stdout));
    if (!parsed.success) throw keychainError('parse');
    return parsed.data;
  }

  async set(tokens: OAuthTokens): Promise<void> {
    const result = await this.run(
      '/usr/bin/security',
      ['add-generic-password', '-U', '-s', SERVICE, '-a', ACCOUNT, '-w'],
      `${JSON.stringify(tokens)}\n`
    );
    if (result.exitCode !== 0) throw keychainError('write');
  }

  async delete(): Promise<void> {
    const result = await this.run('/usr/bin/security', ['delete-generic-password', '-s', SERVICE, '-a', ACCOUNT]);
    if (result.exitCode !== 0 && result.exitCode !== 44) throw keychainError('delete');
  }
}

async function runCommand(file: string, args: readonly string[], input?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, [...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 1 }));
    child.stdin.end(input);
  });
}

function keychainError(operation: string): XCliError {
  return new XCliError('AUTH_REQUIRED', `Unable to ${operation} OAuth credentials in macOS Keychain`, 2);
}
