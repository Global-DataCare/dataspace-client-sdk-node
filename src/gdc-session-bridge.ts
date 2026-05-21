import type { DataspaceNodeClient } from './client.js';
import type {
  GdcActorFacadeDescriptor,
  GdcActorKind,
  GdcActorSessionDescriptor,
} from '../../gdc-sdk-core-ts/dist/index.js';
import {
  createNodeActorSessionFromDescriptor,
  createNodeActorSessionFromFacade,
  createNodeActorSessionsFromDescriptor,
  createNodeActorSessionsFromFacades,
} from '../../gdc-sdk-node-ts/dist/index.js';
import { ActorSession } from './session.js';
import { DataspaceNodeRuntimeClientAdapter } from './gdc-node-runtime-client-adapter.js';

export function createActorSessionsFromGdcFacades(
  client: DataspaceNodeClient,
  facades: GdcActorFacadeDescriptor[],
): ActorSession[] {
  return createNodeActorSessionsFromFacades(
    facades,
    new DataspaceNodeRuntimeClientAdapter(client),
  ) as ActorSession[];
}

export function createActorSessionFromGdcFacade(
  client: DataspaceNodeClient,
  facade: GdcActorFacadeDescriptor,
): ActorSession {
  return createNodeActorSessionFromFacade(
    facade,
    new DataspaceNodeRuntimeClientAdapter(client),
  ) as ActorSession;
}

export function createActorSessionsFromGdcDescriptor(
  client: DataspaceNodeClient,
  descriptor: GdcActorSessionDescriptor,
): ActorSession[] {
  return createNodeActorSessionsFromDescriptor(
    descriptor,
    new DataspaceNodeRuntimeClientAdapter(client),
  ) as ActorSession[];
}

export function createActorSessionFromGdcDescriptor(
  client: DataspaceNodeClient,
  descriptor: GdcActorSessionDescriptor,
  actorKind: GdcActorKind,
): ActorSession {
  return createNodeActorSessionFromDescriptor(
    descriptor,
    actorKind,
    new DataspaceNodeRuntimeClientAdapter(client),
  ) as ActorSession;
}
