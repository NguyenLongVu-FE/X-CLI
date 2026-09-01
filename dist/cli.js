#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.js';
import { createProductionApp, runCommand } from './app.js';
import { XCliError } from './errors.js';
export function helpText() {
    return `Usage: x <command>

Commands:
  browser list
  browser bind <username> --browser <browser-key>
  browser status
  auth status (deprecated alias of browser status)
  me
  feed for-you|following [--limit <n>]
  timeline home|following
  search posts <query>
  post get|create|delete
  reply <post> --text <text> [--media <path>...]
  like|unlike <post>
  follow|unfollow <username>
  following check <username>
  bookmark list|add|remove
  dm list|read|send       Existing visible one-to-one conversations only
  bulk plan --input <file.json>
  bulk execute <action-id>
  action execute <action-id>
`;
}
export async function main(arguments_) {
    if (arguments_.length === 0 || arguments_[0] === '--help' || arguments_[0] === '-h') {
        process.stdout.write(helpText());
        return;
    }
    const command = parseArgs(arguments_);
    process.stdout.write(await runCommand(command, createProductionApp()));
}
if (process.argv[1] !== undefined && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
    void main(process.argv.slice(2)).catch((error) => {
        if (error instanceof XCliError) {
            process.stderr.write(`${JSON.stringify({ error: { code: error.code, message: error.message, details: error.details } })}\n`);
            process.exitCode = error.exitCode;
        }
        else {
            process.stderr.write(`${JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } })}\n`);
            process.exitCode = 1;
        }
    });
}
