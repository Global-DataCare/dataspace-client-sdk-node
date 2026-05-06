import type { WalletProvider } from './provider.js';
import type { WalletContext } from './types.js';
import { WalletClient } from './WalletClient.js';
export declare class MultiWalletClient {
    private readonly provider;
    private readonly walletClients;
    constructor(provider: WalletProvider);
    forContext(context: WalletContext): WalletClient;
}
