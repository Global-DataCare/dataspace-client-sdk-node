import { createHash } from 'node:crypto';
import { MemoryWalletProvider } from './memory-provider.js';
function stableWalletId(seed, context) {
    return createHash('sha256')
        .update(`${seed}:${context.tenantId}:${context.jurisdiction}:${context.sector}:${context.walletId ?? 'default'}`)
        .digest('base64url')
        .slice(0, 24);
}
/**
 * Dev-only provider.
 *
 * It stabilizes wallet identity selection from a seed, but it is not intended
 * for production custody or HSM-backed key management.
 */
export class SeedWalletProvider extends MemoryWalletProvider {
    seed;
    kind = 'seed';
    constructor(seed) {
        super();
        this.seed = seed;
    }
    ensureKeyPair(context) {
        return super.ensureKeyPair({
            ...context,
            walletId: stableWalletId(this.seed, context),
        });
    }
}
