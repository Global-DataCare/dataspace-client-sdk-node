import type { WalletProvider } from './provider.js';
import type { WalletContext } from './types.js';
import { WalletClient } from './WalletClient.js';

function contextKey(context: WalletContext): string {
  return [context.tenantId, context.jurisdiction, context.sector, context.walletId ?? 'default'].join(':');
}

export class MultiWalletClient {
  private readonly walletClients = new Map<string, WalletClient>();

  public constructor(private readonly provider: WalletProvider) {}

  public forContext(context: WalletContext): WalletClient {
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