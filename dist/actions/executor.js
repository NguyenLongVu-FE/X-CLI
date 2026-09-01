export class ActionExecutor {
    store;
    getAccountId;
    writer;
    constructor(store, getAccountId, writer) {
        this.store = store;
        this.getAccountId = getAccountId;
        this.writer = writer;
    }
    async execute(actionId) {
        const accountId = await this.getAccountId();
        const preview = await this.store.inspect(actionId, accountId);
        await this.writer.validate?.(preview);
        const action = await this.store.consume(actionId, accountId);
        return { ...(await this.writer.execute(action)), actionId, kind: action.kind };
    }
}
