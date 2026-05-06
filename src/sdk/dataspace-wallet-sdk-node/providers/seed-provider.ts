import { createHash } from 'node:crypto';
import type { WalletContext } from '../types.js';
import { MemoryWalletProvider } from './memory-provider.js';

function stableWalletId(seed: string, context: WalletContext): string {
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
  public readonly kind = 'seed' as const;

  public constructor(private readonly seed: string) {
    super();
  }

  protected override ensureKeyPair(context: WalletContext) {
    return super.ensureKeyPair({
      ...context,
      walletId: stableWalletId(this.seed, context),
    });
  }
}