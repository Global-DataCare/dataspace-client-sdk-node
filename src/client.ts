import type {
  AsyncPollRequest,
  ClientOptions,
  HostRouteContext,
  PollOptions,
  PollResult,
  RouteContext,
  SubmitAndPollResult,
  SubmitResponse,
  V1Action,
  V1Section,
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

  public v1Path(
    ctx: RouteContext,
    section: V1Section,
    format: string,
    resourceType: string,
    action: V1Action,
  ): string {
    return `/${encode(ctx.tenantId)}/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/${encode(section)}/${encode(format)}/${encode(resourceType)}/${encode(action)}`;
  }

  public hostRegistryPath(
    ctx: HostRouteContext,
    resourceType: string,
    action: V1Action,
  ): string {
    return `/host/cds-${encode(ctx.jurisdiction)}/v1/${encode(ctx.sector)}/registry/org.schema/${encode(resourceType)}/${encode(action)}`;
  }

  public hostRegistryOrganizationBatchPath(ctx: HostRouteContext): string {
    return this.hostRegistryPath(ctx, 'Organization', '_batch');
  }

  public hostRegistryOrganizationPollPath(ctx: HostRouteContext): string {
    return this.hostRegistryPath(ctx, 'Organization', '_batch-response');
  }

  public hostRegistryOrganizationActivatePath(ctx: HostRouteContext): string {
    return this.hostRegistryPath(ctx, 'Organization', '_activate');
  }

  public hostRegistryOrganizationActivatePollPath(ctx: HostRouteContext): string {
    return this.hostRegistryPath(ctx, 'Organization', '_activate-response');
  }

  public hostRegistryOrderBatchPath(ctx: HostRouteContext): string {
    return this.hostRegistryPath(ctx, 'Order', '_batch');
  }

  public hostRegistryOrderPollPath(ctx: HostRouteContext): string {
    return this.hostRegistryPath(ctx, 'Order', '_batch-response');
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
    return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'Task', '_batch');
  }

  public individualTaskPollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'Task', '_batch-response');
  }

  public employeeBatchPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'entity', 'org.schema', 'Employee', '_batch');
  }

  public employeePollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'entity', 'org.schema', 'Employee', '_batch-response');
  }

  public individualLegacyPersonBatchPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'individual', 'org.schema', 'Person', '_batch');
  }

  public individualConsentR4BatchPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Consent', '_batch');
  }

  public individualConsentR4PollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Consent', '_batch-response');
  }

  public individualCompositionR4BatchPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Composition', '_batch');
  }

  public individualCompositionR4PollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Composition', '_batch-response');
  }

  public digitalTwinCompositionApiBatchPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.api', 'Composition', '_batch');
  }

  public digitalTwinCompositionApiPollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.api', 'Composition', '_batch-response');
  }

  public digitalTwinCompositionR4BatchPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.r4', 'Composition', '_batch');
  }

  public digitalTwinCompositionR4PollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.r4', 'Composition', '_batch-response');
  }

  public identityDeviceDcrPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'openid', 'Device', '_dcr');
  }

  public identityDeviceDcrPollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'openid', 'Device', '_dcr-response');
  }

  public identityTokenExchangePath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'openid', 'Token', '_exchange');
  }

  public identityTokenExchangePollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'openid', 'Token', '_exchange-response');
  }

  public identityLicenseIssuePath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'openid', 'License', '_issue');
  }

  public identitySmartTokenPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'openid', 'smart', 'token');
  }

  public identitySmartTokenPollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'openid', 'smart', 'token-response');
  }

  public identityFirebaseCustomPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'firebase', 'Token', '_custom');
  }

  public identityFirebaseCustomPollPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'identity', 'firebase', 'Token', '_custom-response');
  }

  public taskDebugCallStartPath(ctx: RouteContext, format = 'org.hl7.fhir.api'): string {
    return this.v1Path(ctx, 'individual', format, 'Task', '_call-start');
  }

  public taskDebugLogsPath(ctx: RouteContext, format = 'org.hl7.fhir.api'): string {
    return this.v1Path(ctx, 'individual', format, 'Task', '_logs');
  }

  // ---- Generic batch API --------------------------------------------------

  public async submitBatch(path: string, payload: unknown): Promise<SubmitResponse> {
    const response = await this.doPost(path, payload, 'application/didcomm-plaintext+json');
    const body = await this.parseResponseBody(response);

    return {
      status: response.status,
      location: response.headers.get('location') ?? undefined,
      body,
    };
  }

  public async postJson(path: string, payload: unknown): Promise<SubmitResponse> {
    const response = await this.doPost(path, payload, 'application/json');
    const body = await this.parseResponseBody(response);
    return {
      status: response.status,
      location: response.headers.get('location') ?? undefined,
      body,
    };
  }

  public async pollBatchResponse(path: string, request: AsyncPollRequest): Promise<{ status: number; body: unknown }> {
    const response = await this.doPost(path, request, 'application/json');
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

  private async doPost(path: string, payload: unknown, contentType: string): Promise<Response> {
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
