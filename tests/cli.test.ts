import { describe, expect, it } from 'vitest';

import { helpText } from '../src/cli.js';

describe('CLI help', () => {
  it('advertises every first-release command family', () => {
    for (const command of ['browser', 'feed', 'timeline', 'search', 'post', 'reply', 'like', 'follow', 'bookmark', 'dm', 'bulk', 'action']) {
      expect(helpText()).toContain(command);
    }
    expect(helpText()).toContain('post get|create|delete');
    expect(helpText()).toContain('following check');
  });
});
