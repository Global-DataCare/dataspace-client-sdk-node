import { WalletClient } from './WalletClient.js';
function contextKey(context) {
    return [context.tenantId, context.jurisdiction, context.sector, context.walletId ?? 'default'].join(':');
}
export class MultiWalletClient {
    provider;
    walletClients = new Map();
    constructor(provider) {
        this.provider = provider;
    }
    forContext(context) {
        const key = contextKey(context);
        const existing = this.walletClients.get(key);
        if (existing) {
            return existing;
        }
        const created = new WalletClient(this.provider, context);
        this.walletClients.set(key, created);
        return created;
    }
}
