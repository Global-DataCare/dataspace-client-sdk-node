import type { DataspaceNodeClient } from '../client.js';
import { GdcOrganizationControllerSdk } from '../../../gdc-sdk-node-ts/dist/index.js';
import { DataspaceNodeRuntimeClientAdapter } from '../gdc-node-runtime-client-adapter.js';

export class OrganizationControllerSdk extends GdcOrganizationControllerSdk {
  constructor(client: DataspaceNodeClient) {
    super(new DataspaceNodeRuntimeClientAdapter(client));
  }
}
