import { XCliError } from '../errors.js';

export interface UsageEntry { date: string; operation: string; cost: number }
export interface UsageStore {
  list(date: string): Promise<readonly UsageEntry[]>;
  add(entry: UsageEntry): Promise<void>;
}

export class MemoryUsageStore implements UsageStore {
  private readonly entries: UsageEntry[] = [];
  async list(date: string): Promise<readonly UsageEntry[]> { return this.entries.filter((entry) => entry.date === date); }
  async add(entry: UsageEntry): Promise<void> { this.entries.push(entry); }
}

export class CostGuard {
  constructor(
    private readonly store: UsageStore,
    private readonly dailyLimitUsd: number,
    private readonly now: () => Date = () => new Date()
  ) {}

  async assertAllowed(operation: string, estimatedCost: number): Promise<void> {
    const date = this.date();
    const spent = (await this.store.list(date)).reduce((sum, entry) => sum + entry.cost, 0);
    if (spent + estimatedCost > this.dailyLimitUsd) {
      throw new XCliError('INSUFFICIENT_CREDITS', `Daily API cost limit of $${this.dailyLimitUsd.toFixed(2)} would be exceeded`, 3);
    }
  }

  async record(operation: string, cost: number): Promise<void> {
    await this.store.add({ date: this.date(), operation, cost });
  }

  private date(): string { return this.now().toISOString().slice(0, 10); }
}
