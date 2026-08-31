export interface UsageEntry {
    date: string;
    operation: string;
    cost: number;
}
export interface UsageStore {
    list(date: string): Promise<readonly UsageEntry[]>;
    add(entry: UsageEntry): Promise<void>;
}
export declare class MemoryUsageStore implements UsageStore {
    private readonly entries;
    list(date: string): Promise<readonly UsageEntry[]>;
    add(entry: UsageEntry): Promise<void>;
}
export declare class CostGuard {
    private readonly store;
    private readonly dailyLimitUsd;
    private readonly now;
    constructor(store: UsageStore, dailyLimitUsd: number, now?: () => Date);
    assertAllowed(operation: string, estimatedCost: number): Promise<void>;
    record(operation: string, cost: number): Promise<void>;
    private date;
}
