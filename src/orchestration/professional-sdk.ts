import type { DataspaceNodeClient } from '../client.js';
import type { RouteContext, PollOptions } from '../types.js';

export class ProfessionalSdk {
  private readonly client: DataspaceNodeClient;

  constructor(client: DataspaceNodeClient) {
    this.client = client;
  }

  public activateOrganizationInGatewayFromIcaProof(
    hostCtx: Parameters<DataspaceNodeClient['activateOrganizationInGatewayFromIcaProof']>[0],
    input: Parameters<DataspaceNodeClient['activateOrganizationInGatewayFromIcaProof']>[1],
    pollOptions?: PollOptions,
  ): ReturnType<DataspaceNodeClient['activateOrganizationInGatewayFromIcaProof']> {
    return this.client.activateOrganizationInGatewayFromIcaProof(hostCtx, input, pollOptions);
  }

  public createOrganizationEmployee(
    routeCtx: RouteContext,
    input: Parameters<DataspaceNodeClient['createOrganizationEmployee']>[1],
    pollOptions?: PollOptions,
  ): ReturnType<DataspaceNodeClient['createOrganizationEmployee']> {
    return this.client.createOrganizationEmployee(routeCtx, input, pollOptions);
  }

  public activateEmployeeDeviceWithActivationCodeSimple(
    input: Parameters<DataspaceNodeClient['activateEmployeeDeviceWithActivationCodeSimple']>[0],
  ): ReturnType<DataspaceNodeClient['activateEmployeeDeviceWithActivationCodeSimple']> {
    return this.client.activateEmployeeDeviceWithActivationCodeSimple(input);
  }

  public requestSmartTokenSimple(
    input: Parameters<DataspaceNodeClient['requestSmartTokenSimple']>[0],
  ): ReturnType<DataspaceNodeClient['requestSmartTokenSimple']> {
    return this.client.requestSmartTokenSimple(input);
  }

  public ingestCommunicationAndUpdateIndex(
    routeCtx: RouteContext,
    input: Parameters<DataspaceNodeClient['ingestCommunicationAndUpdateIndex']>[1],
  ): ReturnType<DataspaceNodeClient['ingestCommunicationAndUpdateIndex']> {
    return this.client.ingestCommunicationAndUpdateIndex(routeCtx, input);
  }

  public grantProfessionalAccessSimple(
    ctx: Parameters<DataspaceNodeClient['grantProfessionalAccessSimple']>[0],
    input: Parameters<DataspaceNodeClient['grantProfessionalAccessSimple']>[1],
  ): ReturnType<DataspaceNodeClient['grantProfessionalAccessSimple']> {
    return this.client.grantProfessionalAccessSimple(ctx, input);
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
