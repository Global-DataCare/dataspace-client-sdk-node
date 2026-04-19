import type {
  AsyncPollRequest,
  ClientOptions,
  HostRouteContext,
  PollOptions,
  PollResult,
  RouteContext,
  SubmitAndPollResult,
  SubmitResponse,
} from './types.js';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

export class DataspaceNodeClient {
  private readonly baseUrl: string;
  private readonly bearerToken?: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ClientOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.bearerToken = options.bearerToken;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  // ---- Path helpers -------------------------------------------------------

  public hostRegistryOrganizationBatchPath(ctx: HostRouteContext): string {
    return `/host/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/registry/org.schema/Organization/_batch`;
  }

  public hostRegistryOrganizationPollPath(ctx: HostRouteContext): string {
    return `/host/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/registry/org.schema/Organization/_batch-response`;
  }

  public hostRegistryOrderBatchPath(ctx: HostRouteContext): string {
    return `/host/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/registry/org.schema/Order/_batch`;
  }

  public hostRegistryOrderPollPath(ctx: HostRouteContext): string {
    return `/host/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/registry/org.schema/Order/_batch-response`;
  }

  public individualFamilyOrganizationBatchPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.schema/Organization/_batch`;
  }

  public individualFamilyOrganizationPollPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.schema/Organization/_batch-response`;
  }

  public individualFamilyOrderBatchPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.schema/Order/_batch`;
  }

  public individualFamilyOrderPollPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.schema/Order/_batch-response`;
  }

  public individualRelatedPersonBatchPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/RelatedPerson/_batch`;
  }

  public individualRelatedPersonPollPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/RelatedPerson/_batch-response`;
  }

  public individualObservationBatchPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/Observation/_batch`;
  }

  public individualObservationPollPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/Observation/_batch-response`;
  }

  public individualCommunicationBatchPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.r4/Communication/_batch`;
  }

  public individualCommunicationPollPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.r4/Communication/_batch-response`;
  }

  public individualTaskBatchPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/Task/_batch`;
  }

  public individualTaskPollPath(ctx: RouteContext): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/individual/org.hl7.fhir.api/Task/_batch-response`;
  }

  // ---- Generic batch API --------------------------------------------------

  public async submitBatch(path: string, payload: unknown): Promise<SubmitResponse> {
    const response = await this.postJson(path, payload, 'application/didcomm-plaintext+json');
    const body = await this.parseResponseBody(response);

    return {
      status: response.status,
      location: response.headers.get('location') ?? undefined,
      body,
    };
  }

  public async pollBatchResponse(path: string, request: AsyncPollRequest): Promise<{ status: number; body: unknown }> {
    const response = await this.postJson(path, request, 'application/json');
    return {
      status: response.status,
      body: await this.parseResponseBody(response),
    };
  }

  public async submitAndPoll(
    submitPath: string,
    pollPath: string,
    payload: { thid?: string } & Record<string, unknown>,
    options?: PollOptions,
  ): Promise<SubmitAndPollResult> {
    const submit = await this.submitBatch(submitPath, payload);

    const thid = String(payload.thid || '').trim();
    if (!thid) {
      throw new Error('submitAndPoll requires payload.thid.');
    }

    const poll = await this.pollUntilComplete(pollPath, { thid }, options);
    return { submit, poll };
  }

  public async pollUntilComplete(path: string, request: AsyncPollRequest, options?: PollOptions): Promise<PollResult> {
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const intervalMs = options?.intervalMs ?? 2_000;
    const startedAt = Date.now();
    let attempts = 0;

    while (true) {
      attempts += 1;
      const result = await this.pollBatchResponse(path, request);

      if (result.status !== 202) {
        return {
          status: result.status,
          body: result.body,
          attempts,
        };
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Polling timeout after ${attempts} attempts (${timeoutMs}ms).`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // ---- Internal HTTP helpers ---------------------------------------------

  private async postJson(path: string, payload: unknown, contentType: string): Promise<Response> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      'Content-Type': contentType,
      Accept: 'application/json, application/didcomm-plaintext+json, application/x-www-form-urlencoded, */*',
    };

    if (this.bearerToken) {
      headers.Authorization = `Bearer ${this.bearerToken}`;
    }

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('application/didcomm-plaintext+json')) {
      return response.json().catch(() => ({}));
    }
    const text = await response.text();
    return text;
  }
}
