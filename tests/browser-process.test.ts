import { describe, expect, it } from 'vitest';

import { parseMarkedJson } from '../src/browser/runner.js';
import { sanitizePlaywriterEnvironment } from '../src/browser/process.js';

describe('Playwriter process output', () => {
  it('removes every inherited Playwriter remote or cloud setting', () => {
    expect(sanitizePlaywriterEnvironment({ PATH: '/bin', PLAYWRITER_HOST: 'remote', PLAYWRITER_API_KEY: 'secret', PLAYWRITER_FUTURE_REMOTE: 'on' }))
      .toEqual({ PATH: '/bin' });
  });

  it('parses the log prefix emitted by Playwriter 0.5.0', () => {
    expect(parseMarkedJson('[log] __XCLI_RESULT__{"username":"imtamhn"}\n')).toEqual({ username: 'imtamhn' });
  });

  it('rejects multiple result markers because execution may have repeated', () => {
    const output = '__XCLI_RESULT__{"outcome":"confirmed"}\n__XCLI_RESULT__{"outcome":"confirmed"}\n';
    expect(() => parseMarkedJson(output)).toThrowError(expect.objectContaining({ code: 'X_UI_CHANGED' }));
  });
});
