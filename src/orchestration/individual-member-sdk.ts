import type { DataspaceNodeClient } from '../client.js';
import { GdcIndividualMemberSdk } from '../../../gdc-sdk-node-ts/dist/index.js';
import { DataspaceNodeRuntimeClientAdapter } from '../gdc-node-runtime-client-adapter.js';

export class IndividualMemberSdk extends GdcIndividualMemberSdk {
  constructor(client: DataspaceNodeClient) {
    super(new DataspaceNodeRuntimeClientAdapter(client));
  }
}
