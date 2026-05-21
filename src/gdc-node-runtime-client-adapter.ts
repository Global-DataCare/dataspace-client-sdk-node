import type { GdcNodeRuntimeClient } from '../../gdc-sdk-node-ts/dist/index.js';
import type { DataspaceNodeClient } from './client.js';

/**
 * Explicit adapter from the legacy DataspaceNodeClient implementation
 * to the target runtime client contract used by gdc-sdk-node-ts.
 */
export class DataspaceNodeRuntimeClientAdapter implements GdcNodeRuntimeClient {
  private readonly rawClient: any;

  constructor(private readonly client: DataspaceNodeClient) {
    this.rawClient = client as any;
  }

  public activateOrganizationInGatewayFromIcaProof(...args: any[]): Promise<any> {
    return this.rawClient.activateOrganizationInGatewayFromIcaProof(...args);
  }

  public confirmLegalOrganizationOrderSimple(...args: any[]): Promise<any> {
    return this.rawClient.confirmLegalOrganizationOrderSimple(...args);
  }

  public createOrganizationEmployee(...args: any[]): Promise<any> {
    return this.rawClient.createOrganizationEmployee(...args);
  }

  public activateEmployeeDeviceWithActivationCodeSimple(...args: any[]): Promise<any> {
    return this.rawClient.activateEmployeeDeviceWithActivationCodeSimple(...args);
  }

  public requestSmartTokenSimple(...args: any[]): Promise<any> {
    return this.rawClient.requestSmartTokenSimple(...args);
  }

  public startIndividualOrganizationSimple(...args: any[]): Promise<any> {
    return this.rawClient.startIndividualOrganizationSimple(...args);
  }

  public ingestCommunicationAndUpdateIndex(...args: any[]): Promise<any> {
    return this.rawClient.ingestCommunicationAndUpdateIndex(...args);
  }

  public grantProfessionalAccessSimple(...args: any[]): Promise<any> {
    return this.rawClient.grantProfessionalAccessSimple(...args);
  }

  public bootstrapIndividualOrganizationSimple(...args: any[]): Promise<any> {
    return this.rawClient.bootstrapIndividualOrganizationSimple(...args);
  }

  public importIpsOrFhirAndUpdateIndex(...args: any[]): Promise<any> {
    return this.rawClient.importIpsOrFhirAndUpdateIndex(...args);
  }

  public generateDigitalTwinFromSubjectData(...args: any[]): Promise<any> {
    return this.rawClient.generateDigitalTwinFromSubjectData(...args);
  }

  public submitBatch(...args: any[]): Promise<any> {
    return this.rawClient.submitBatch(...args);
  }

  public pollUntilComplete(...args: any[]): Promise<any> {
    return this.rawClient.pollUntilComplete(...args);
  }

  public submitAndPoll(...args: any[]): Promise<any> {
    return this.rawClient.submitAndPoll(...args);
  }
}
