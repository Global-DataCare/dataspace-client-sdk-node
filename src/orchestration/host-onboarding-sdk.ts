import type { DataspaceNodeClient } from '../client.js';
import { GdcHostOnboardingSdk } from '../../../gdc-sdk-node-ts/dist/index.js';
import { DataspaceNodeRuntimeClientAdapter } from '../gdc-node-runtime-client-adapter.js';

export class HostOnboardingSdk extends GdcHostOnboardingSdk {
  constructor(client: DataspaceNodeClient) {
    super(new DataspaceNodeRuntimeClientAdapter(client));
  }
}
