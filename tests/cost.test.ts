import { describe, expect, it } from 'vitest';

import { CostGuard, MemoryUsageStore } from '../src/api/cost.js';

describe('daily API cost guard', () => {
  it('rejects an operation that would exceed the configured daily limit', async () => {
    const store = new MemoryUsageStore();
    const guard = new CostGuard(store, 0.02, () => new Date('2026-08-31T10:00:00Z'));
    await guard.record('content-create', 0.015);
    await expect(guard.assertAllowed('interaction-create', 0.015)).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
  });

  it('keeps usage isolated by day', async () => {
    const store = new MemoryUsageStore();
    await store.add({ date: '2026-08-30', operation: 'read', cost: 10 });
    await expect(new CostGuard(store, 0.01, () => new Date('2026-08-31T00:00:00Z')).assertAllowed('read', 0.001)).resolves.toBeUndefined();
  });
});
