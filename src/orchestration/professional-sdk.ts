import type { DataspaceNodeClient } from '../client.js';
import { GdcProfessionalSdk } from '../../../gdc-sdk-node-ts/dist/index.js';
import { DataspaceNodeRuntimeClientAdapter } from '../gdc-node-runtime-client-adapter.js';

export class ProfessionalSdk extends GdcProfessionalSdk {
  constructor(client: DataspaceNodeClient) {
    super(new DataspaceNodeRuntimeClientAdapter(client));
  }
}
