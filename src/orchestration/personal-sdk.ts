import type { DataspaceNodeClient } from '../client.js';
import type { RouteContext, PollOptions } from '../types.js';

export class PersonalSdk {
  private readonly client: DataspaceNodeClient;

  constructor(client: DataspaceNodeClient) {
    this.client = client;
  }

  public bootstrapIndividualOrganizationSimple(
    input: Parameters<DataspaceNodeClient['bootstrapIndividualOrganizationSimple']>[0],
  ): ReturnType<DataspaceNodeClient['bootstrapIndividualOrganizationSimple']> {
    return this.client.bootstrapIndividualOrganizationSimple(input);
  }

  public grantProfessionalAccessSimple(
    ctx: Parameters<DataspaceNodeClient['grantProfessionalAccessSimple']>[0],
    input: Parameters<DataspaceNodeClient['grantProfessionalAccessSimple']>[1],
  ): ReturnType<DataspaceNodeClient['grantProfessionalAccessSimple']> {
    return this.client.grantProfessionalAccessSimple(ctx, input);
  }

  public importIpsOrFhirAndUpdateIndex(
    routeCtx: RouteContext,
    input: Parameters<DataspaceNodeClient['importIpsOrFhirAndUpdateIndex']>[1],
  ): ReturnType<DataspaceNodeClient['importIpsOrFhirAndUpdateIndex']> {
    return this.client.importIpsOrFhirAndUpdateIndex(routeCtx, input);
  }

  public ingestCommunicationAndUpdateIndex(
    routeCtx: RouteContext,
    input: Parameters<DataspaceNodeClient['ingestCommunicationAndUpdateIndex']>[1],
  ): ReturnType<DataspaceNodeClient['ingestCommunicationAndUpdateIndex']> {
    return this.client.ingestCommunicationAndUpdateIndex(routeCtx, input);
  }

  public generateDigitalTwinFromSubjectData(
    routeCtx: RouteContext,
    input: Parameters<DataspaceNodeClient['generateDigitalTwinFromSubjectData']>[1],
  ): ReturnType<DataspaceNodeClient['generateDigitalTwinFromSubjectData']> {
    return this.client.generateDigitalTwinFromSubjectData(routeCtx, input);
  }

  public requestSmartTokenSimple(
    input: Parameters<DataspaceNodeClient['requestSmartTokenSimple']>[0],
  ): ReturnType<DataspaceNodeClient['requestSmartTokenSimple']> {
    return this.client.requestSmartTokenSimple(input);
  }

  public submitAndPoll(
    submitPath: string,
    pollPath: string,
    payload: { thid?: string } & Record<string, unknown>,
    pollOptions?: PollOptions,
  ): ReturnType<DataspaceNodeClient['submitAndPoll']> {
    return this.client.submitAndPoll(submitPath, pollPath, payload, pollOptions);
  }
}
