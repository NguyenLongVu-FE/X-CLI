#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.js';
import { createProductionApp, runCommand } from './app.js';
import { XCliError } from './errors.js';

export function helpText(): string {
  return `Usage: x <command>

Commands:
  auth login|status|logout
  me
  timeline home|following
  search posts <query>
  post get|create
  reply <post> --text <text>
  like|unlike <post>
  follow|unfollow <username>
  action execute <action-id>
`;
}

export async function main(arguments_: readonly string[]): Promise<void> {
  if (arguments_.length === 0 || arguments_[0] === '--help' || arguments_[0] === '-h') {
    process.stdout.write(helpText());
    return;
  }
  const command = parseArgs(arguments_);
  const clientId = process.env.X_CLIENT_ID ?? '';
  if (command.kind === 'auth-login' && clientId === '') throw new XCliError('AUTH_REQUIRED', 'Set X_CLIENT_ID before login', 2);
  process.stdout.write(await runCommand(command, createProductionApp(clientId)));
}

if (process.argv[1] !== undefined && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof XCliError) {
      process.stderr.write(`${JSON.stringify({ error: { code: error.code, message: error.message, details: error.details } })}\n`);
      process.exitCode = error.exitCode;
    } else {
      process.stderr.write(`${JSON.stringify({ error: { code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } })}\n`);
      process.exitCode = 1;
    }
  });
}
