import type { DataspaceNodeClient } from '../client.js';
import { GdcIndividualControllerSdk } from '../../../gdc-sdk-node-ts/dist/index.js';
import { DataspaceNodeRuntimeClientAdapter } from '../gdc-node-runtime-client-adapter.js';

export class IndividualControllerSdk extends GdcIndividualControllerSdk {
  private readonly rawClient: DataspaceNodeClient;

  constructor(client: DataspaceNodeClient) {
    super(new DataspaceNodeRuntimeClientAdapter(client));
    this.rawClient = client;
  }

  /**
   * Legacy compatibility helper.
   * Not part of the target `gdc-sdk-node-ts` actor surface.
   */
  public bootstrapIndividualOrganizationSimple(...args: any[]): Promise<any> {
    return (this.rawClient as any).bootstrapIndividualOrganizationSimple(...args);
  }
}
