import { ClaimsOfferSchemaorg } from 'gdc-common-utils-ts/constants/schemaorg';
import type { OfferInfo, OfferPreview, PollResult, SubmitAndPollResult } from './types.js';

export class DataspaceNodeResponseHelpers {
  public getDidcommMessageBodyFromResponse(
    result: SubmitAndPollResult | PollResult | unknown,
  ): Record<string, unknown> | undefined {
    const pollBody = (result as any)?.poll?.body ?? (result as any)?.body ?? result;
    const didcommBody = (pollBody as any)?.body;
    if (didcommBody && typeof didcommBody === 'object') return didcommBody as Record<string, unknown>;
    if (pollBody && typeof pollBody === 'object' && Array.isArray((pollBody as any)?.data)) {
      return pollBody as Record<string, unknown>;
    }
    return undefined;
  }

  public getFirstDidcommDataEntryFromResponse(
    result: SubmitAndPollResult | PollResult | unknown,
  ): Record<string, unknown> | undefined {
    const body = this.getDidcommMessageBodyFromResponse(result);
    const entry = (body as any)?.data?.[0];
    return entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : undefined;
  }

  public getOfferIdFromResponse(result: SubmitAndPollResult | PollResult | unknown): string | undefined {
    const entry = this.getFirstDidcommDataEntryFromResponse(result);
    const offerId = String(
      (entry as any)?.resource?.meta?.claims?.[ClaimsOfferSchemaorg.identifier]
      || (entry as any)?.meta?.claims?.[ClaimsOfferSchemaorg.identifier]
      || '',
    ).trim();
    return offerId || undefined;
  }

  public getOfferPreviewFromResponse(result: SubmitAndPollResult | PollResult | unknown): OfferPreview {
    const entry = this.getFirstDidcommDataEntryFromResponse(result) as any;
    const claims = entry?.resource?.meta?.claims || entry?.meta?.claims || {};
    const seatsRaw = claims[ClaimsOfferSchemaorg.eligibleQuantityValue];
    const seats =
      typeof seatsRaw === 'number'
        ? seatsRaw
        : (typeof seatsRaw === 'string' && seatsRaw.trim() ? Number(seatsRaw) : undefined);
    return {
      offerId: this.getOfferIdFromResponse(result),
      amount: claims[ClaimsOfferSchemaorg.price],
      currency: claims[ClaimsOfferSchemaorg.priceCurrency],
      seats: Number.isFinite(seats as number) ? seats : undefined,
      planName: claims[ClaimsOfferSchemaorg.itemOfferedName],
      sku: claims[ClaimsOfferSchemaorg.itemOfferedSku],
      paymentMethod: claims[ClaimsOfferSchemaorg.acceptedPaymentMethod],
      checkoutUrl: claims[ClaimsOfferSchemaorg.checkoutPageURLTemplate],
    };
  }

  public getOfferInfoFromResponse(result: SubmitAndPollResult | PollResult | unknown): OfferInfo {
    return this.getOfferPreviewFromResponse(result);
  }

  public getActivationCodeFromResponse(result: SubmitAndPollResult | PollResult | unknown): string | undefined {
    const root = (result as any)?.poll?.body || (result as any)?.body || {};
    const byBody = String(root?.activationCode || root?.body?.activationCode || '').trim();
    if (byBody) return byBody;

    const entry = this.getFirstDidcommDataEntryFromResponse(result) as any;
    const claims = entry?.resource?.meta?.claims || entry?.meta?.claims || {};
    const byClaims = String(
      claims['org.schema.IndividualProduct.serialNumber']
      || claims['org.schema.Offer.serialNumber']
      || claims.activationCode
      || '',
    ).trim();
    return byClaims || undefined;
  }

  public assertFirstDidcommEntrySuccess(
    result: SubmitAndPollResult | PollResult | unknown,
    contextLabel: string,
  ): void {
    const entry = this.getFirstDidcommDataEntryFromResponse(result) as any;
    const responseStatusRaw = entry?.response?.status;
    const responseStatus = Number(responseStatusRaw);
    if (!Number.isFinite(responseStatus) || responseStatus < 400) return;

    const diagnostics =
      String(
        entry?.response?.outcome?.issue?.[0]?.diagnostics
        || entry?.response?.outcome?.issue?.[0]?.details?.text
        || '',
      ).trim();
    throw new Error(
      `${contextLabel} failed (business status=${responseStatus})${diagnostics ? `: ${diagnostics}` : ''}`,
    );
  }
}
