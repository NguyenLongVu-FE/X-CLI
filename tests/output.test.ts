import { describe, expect, it } from 'vitest';

import { formatJson, formatNdjson } from '../src/output.js';

describe('machine output', () => {
  it('formats one JSON value with a trailing newline', () => {
    expect(formatJson({ id: '1' })).toBe('{"id":"1"}\n');
  });

  it('formats collections as one JSON value per line', () => {
    expect(formatNdjson([{ id: '1' }, { id: '2' }])).toBe('{"id":"1"}\n{"id":"2"}\n');
    expect(formatNdjson([])).toBe('');
  });
});
