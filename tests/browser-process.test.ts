import { describe, expect, it } from 'vitest';

import { parseMarkedJson } from '../src/browser/runner.js';

describe('Playwriter process output', () => {
  it('rejects multiple result markers because execution may have repeated', () => {
    const output = '__XCLI_RESULT__{"outcome":"confirmed"}\n__XCLI_RESULT__{"outcome":"confirmed"}\n';
    expect(() => parseMarkedJson(output)).toThrowError(expect.objectContaining({ code: 'X_UI_CHANGED' }));
  });
});
