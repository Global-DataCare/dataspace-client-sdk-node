import type { DataspaceNodeClient } from '../client.js';
import { GdcOrganizationEmployeeSdk } from '../../../gdc-sdk-node-ts/dist/index.js';
import { DataspaceNodeRuntimeClientAdapter } from '../gdc-node-runtime-client-adapter.js';

export class OrganizationEmployeeSdk extends GdcOrganizationEmployeeSdk {
  constructor(client: DataspaceNodeClient) {
    super(new DataspaceNodeRuntimeClientAdapter(client));
  }
}
