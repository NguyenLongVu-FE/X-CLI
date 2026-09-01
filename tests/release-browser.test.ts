import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { helpText } from '../src/cli.js';

describe('browser-only release contract', () => {
  it('advertises the complete browser command surface', () => {
    const help = helpText();
    for (const command of [
      'browser list', 'browser bind', 'browser status', 'feed for-you|following',
      'bookmark list|add|remove', 'dm list|read|send', 'bulk plan', 'bulk execute', 'action execute'
    ]) expect(help).toContain(command);
  });

  it('ships Playwriter without API or Keychain dependencies', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { description: string; dependencies: Record<string, string> };
    expect(packageJson.dependencies.playwriter).toBe('0.4.0');
    expect(packageJson.dependencies).not.toHaveProperty('@napi-rs/keyring');
    expect(packageJson.description.toLowerCase()).toContain('browser');
  });

  it('contains no production X API, OAuth, or client-id configuration', async () => {
    const files = [
      'src/app.ts', 'src/cli.ts', 'src/index.ts', 'package.json', 'README.md', '.env.example'
    ];
    const contents = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
    expect(contents).not.toMatch(/api\.x\.com|X_CLIENT_ID|oauth\/token|official X API|@napi-rs\/keyring/i);
  });
});
