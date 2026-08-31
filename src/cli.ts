#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

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
  throw new Error(`Unknown command: ${arguments_.join(' ')}`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}
