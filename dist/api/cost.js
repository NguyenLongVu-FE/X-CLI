import { XCliError } from '../errors.js';
export class MemoryUsageStore {
    entries = [];
    async list(date) { return this.entries.filter((entry) => entry.date === date); }
    async add(entry) { this.entries.push(entry); }
}
export class CostGuard {
    store;
    dailyLimitUsd;
    now;
    constructor(store, dailyLimitUsd, now = () => new Date()) {
        this.store = store;
        this.dailyLimitUsd = dailyLimitUsd;
        this.now = now;
    }
    async assertAllowed(operation, estimatedCost) {
        const date = this.date();
        const spent = (await this.store.list(date)).reduce((sum, entry) => sum + entry.cost, 0);
        if (spent + estimatedCost > this.dailyLimitUsd) {
            throw new XCliError('INSUFFICIENT_CREDITS', `Daily API cost limit of $${this.dailyLimitUsd.toFixed(2)} would be exceeded`, 3);
        }
    }
    async record(operation, cost) {
        await this.store.add({ date: this.date(), operation, cost });
    }
    date() { return this.now().toISOString().slice(0, 10); }
}
