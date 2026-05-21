import type { DataspaceNodeClient } from './client.js';
import {
  GdcNodeActorSession,
  type GdcNodeActorSessionContext,
  type GdcNodeCapability,
} from '../../gdc-sdk-node-ts/dist/index.js';
import type { GdcActorKind } from '../../gdc-sdk-core-ts/dist/index.js';
import { DataspaceNodeRuntimeClientAdapter } from './gdc-node-runtime-client-adapter.js';
import { HostOnboardingSdk } from './orchestration/host-onboarding-sdk.js';
import { IndividualControllerSdk } from './orchestration/individual-controller-sdk.js';
import { IndividualMemberSdk } from './orchestration/individual-member-sdk.js';
import { OrganizationControllerSdk } from './orchestration/organization-controller-sdk.js';
import { OrganizationEmployeeSdk } from './orchestration/organization-employee-sdk.js';
import { ProfessionalSdk } from './orchestration/professional-sdk.js';

export type ActorKind = GdcActorKind;

export type Capability = GdcNodeCapability;

export type ActorSessionContext = GdcNodeActorSessionContext;

/**
 * Legacy compatibility wrapper around the target package actor session.
 * Keeps constructor order stable for current SDK consumers.
 */
export class ActorSession extends GdcNodeActorSession {
  private readonly legacyClient: DataspaceNodeClient;

  constructor(client: DataspaceNodeClient, context: ActorSessionContext) {
    const actorKind = context.actorKind;
    super(context, new DataspaceNodeRuntimeClientAdapter(client));
    this.legacyClient = client;
    this.assertActorKind = this.assertActorKind.bind(this);
    this.is = this.is.bind(this);
    if (this.actorKind !== actorKind) {
      throw new Error('ActorSession actor kind mismatch after runtime adaptation.');
    }
  }

  public asHostOnboarding(): HostOnboardingSdk {
    this.assertActorKind('host_onboarding');
    return new HostOnboardingSdk(this.legacyClient);
  }

  public asOrganizationController(): OrganizationControllerSdk {
    this.assertActorKind('organization_controller');
    return new OrganizationControllerSdk(this.legacyClient);
  }

  public asOrganizationEmployee(): OrganizationEmployeeSdk {
    this.assertActorKind('organization_employee');
    return new OrganizationEmployeeSdk(this.legacyClient);
  }

  public asIndividualController(): IndividualControllerSdk {
    this.assertActorKind('individual_controller');
    return new IndividualControllerSdk(this.legacyClient);
  }

  public asIndividualMember(): IndividualMemberSdk {
    this.assertActorKind('individual_member');
    return new IndividualMemberSdk(this.legacyClient);
  }

  public asProfessional(): ProfessionalSdk {
    this.assertActorKind('professional');
    return new ProfessionalSdk(this.legacyClient);
  }
}
