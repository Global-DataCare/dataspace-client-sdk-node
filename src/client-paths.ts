import type {
  HostRouteContext,
  RouteContext,
  V1Action,
  V1Section,
} from './types.js';
import { encodePathSegment } from './client-runtime-utils.js';

export class DataspaceNodePathBuilder {
  constructor(
    private readonly requireRouteContext: (ctx?: RouteContext) => RouteContext,
    private readonly requireHostRouteContext: (ctx?: HostRouteContext) => HostRouteContext,
  ) {}

  public v1Path(
    ctx: RouteContext | undefined,
    section: V1Section,
    format: string,
    resourceType: string,
    action: V1Action,
  ): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(routeCtx.tenantId)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/${encodePathSegment(section)}/${encodePathSegment(format)}/${encodePathSegment(resourceType)}/${encodePathSegment(action)}`;
  }

  public tenantIdentityPath(ctx: RouteContext | undefined, prefix: string, action: string): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(prefix)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/${encodePathSegment(routeCtx.tenantId)}/identity/auth/${encodePathSegment(action)}`;
  }

  public hostRegistryPath(
    ctx: HostRouteContext | undefined,
    resourceType: string,
    action: V1Action,
  ): string {
    const hostCtx = this.requireHostRouteContext(ctx);
    return `/host/cds-${encodePathSegment(hostCtx.jurisdiction)}/v1/${encodePathSegment(hostCtx.sector)}/registry/org.schema/${encodePathSegment(resourceType)}/${encodePathSegment(action)}`;
  }

  public hostRegistryOrganizationBatchPath(ctx?: HostRouteContext): string { return this.hostRegistryPath(ctx, 'Organization', '_batch'); }
  public hostRegistryOrganizationPollPath(ctx?: HostRouteContext): string { return this.hostRegistryPath(ctx, 'Organization', '_batch-response'); }
  public hostRegistryOrganizationActivatePath(ctx?: HostRouteContext): string { return this.hostRegistryPath(ctx, 'Organization', '_activate'); }
  public hostRegistryOrganizationActivatePollPath(ctx?: HostRouteContext): string { return this.hostRegistryPath(ctx, 'Organization', '_activate-response'); }
  public hostRegistryOrderBatchPath(ctx?: HostRouteContext): string { return this.hostRegistryPath(ctx, 'Order', '_batch'); }
  public hostRegistryOrderPollPath(ctx?: HostRouteContext): string { return this.hostRegistryPath(ctx, 'Order', '_batch-response'); }

  public individualFamilyOrganizationBatchPath(ctx?: RouteContext): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(routeCtx.tenantId)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/individual/org.schema/Organization/_batch`;
  }

  public individualFamilyOrganizationPollPath(ctx?: RouteContext): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(routeCtx.tenantId)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/individual/org.schema/Organization/_batch-response`;
  }

  public individualFamilyOrganizationSearchPath(ctx?: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.schema', 'Organization', '_search'); }
  public individualFamilyOrganizationSearchPollPath(ctx?: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.schema', 'Organization', '_search-response'); }

  public individualFamilyOrderBatchPath(ctx?: RouteContext): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(routeCtx.tenantId)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/individual/org.schema/Order/_batch`;
  }

  public individualFamilyOrderPollPath(ctx?: RouteContext): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(routeCtx.tenantId)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/individual/org.schema/Order/_batch-response`;
  }

  public individualRelatedPersonBatchPath(ctx: RouteContext): string {
    return `/${encodePathSegment(ctx.tenantId)}/cds-${encodePathSegment(ctx.jurisdiction)}/v1/${encodePathSegment(ctx.sector)}/individual/org.hl7.fhir.api/RelatedPerson/_batch`;
  }

  public individualRelatedPersonPollPath(ctx: RouteContext): string {
    return `/${encodePathSegment(ctx.tenantId)}/cds-${encodePathSegment(ctx.jurisdiction)}/v1/${encodePathSegment(ctx.sector)}/individual/org.hl7.fhir.api/RelatedPerson/_batch-response`;
  }

  public individualObservationBatchPath(ctx: RouteContext): string {
    return `/${encodePathSegment(ctx.tenantId)}/cds-${encodePathSegment(ctx.jurisdiction)}/v1/${encodePathSegment(ctx.sector)}/individual/org.hl7.fhir.api/Observation/_batch`;
  }

  public individualObservationPollPath(ctx: RouteContext): string {
    return `/${encodePathSegment(ctx.tenantId)}/cds-${encodePathSegment(ctx.jurisdiction)}/v1/${encodePathSegment(ctx.sector)}/individual/org.hl7.fhir.api/Observation/_batch-response`;
  }

  public individualCommunicationBatchPath(
    ctx: RouteContext,
    pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4',
  ): string { return this.v1Path(ctx, 'individual', pathFormatSegment, 'Communication', '_batch'); }

  public individualCommunicationPollPath(
    ctx: RouteContext,
    pathFormatSegment: 'org.hl7.fhir.api' | 'org.hl7.fhir.r4' = 'org.hl7.fhir.r4',
  ): string { return this.v1Path(ctx, 'individual', pathFormatSegment, 'Communication', '_batch-response'); }

  public individualTaskBatchPath(ctx: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'Task', '_batch'); }
  public individualTaskPollPath(ctx: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'Task', '_batch-response'); }
  public employeeBatchPath(ctx?: RouteContext): string { return this.v1Path(ctx, 'entity', 'org.schema', 'Employee', '_batch'); }
  public employeePollPath(ctx?: RouteContext): string { return this.v1Path(ctx, 'entity', 'org.schema', 'Employee', '_batch-response'); }
  public individualLegacyPersonBatchPath(ctx: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.schema', 'Person', '_batch'); }
  public individualConsentR4BatchPath(ctx: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Consent', '_batch'); }
  public individualConsentR4PollPath(ctx: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Consent', '_batch-response'); }
  public individualCompositionR4BatchPath(ctx: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Composition', '_batch'); }
  public individualCompositionR4PollPath(ctx: RouteContext): string { return this.v1Path(ctx, 'individual', 'org.hl7.fhir.r4', 'Composition', '_batch-response'); }
  public digitalTwinCompositionApiBatchPath(ctx: RouteContext): string { return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.api', 'Composition', '_batch'); }
  public digitalTwinCompositionApiPollPath(ctx: RouteContext): string { return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.api', 'Composition', '_batch-response'); }
  public digitalTwinCompositionR4BatchPath(ctx: RouteContext): string { return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.r4', 'Composition', '_batch'); }
  public digitalTwinCompositionR4PollPath(ctx: RouteContext): string { return this.v1Path(ctx, 'digitaltwin', 'org.hl7.fhir.r4', 'Composition', '_batch-response'); }
  public identityDeviceDcrPath(ctx?: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_dcr'); }
  public identityDeviceDcrPollPath(ctx?: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_dcr-response'); }
  public identityTokenExchangePath(ctx?: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_exchange'); }
  public identityTokenExchangePollPath(ctx?: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_exchange-response'); }

  public identityOpenIdSmartTokenPath(ctx?: RouteContext): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(routeCtx.tenantId)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/identity/openid/smart/token`;
  }

  public identityOpenIdSmartTokenPollPath(ctx?: RouteContext): string {
    const routeCtx = this.requireRouteContext(ctx);
    return `/${encodePathSegment(routeCtx.tenantId)}/cds-${encodePathSegment(routeCtx.jurisdiction)}/v1/${encodePathSegment(routeCtx.sector)}/identity/openid/smart/_batch-response`;
  }

  public identityLicenseIssuePath(ctx?: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_issue'); }
  public identitySmartTokenPath(ctx: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_token'); }
  public identitySmartTokenPollPath(ctx: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_token-response'); }
  public identityFirebaseCustomPath(ctx: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_custom'); }
  public identityFirebaseCustomPollPath(ctx: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_custom-response'); }
  public identityCodePath(ctx: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_code'); }
  public identityCodePollPath(ctx: RouteContext): string { return this.tenantIdentityPath(ctx, 'host', '_code-response'); }
  public taskDebugCallStartPath(ctx: RouteContext, format = 'org.hl7.fhir.api'): string { return this.v1Path(ctx, 'individual', format, 'Task', '_call-start'); }
  public taskDebugLogsPath(ctx: RouteContext, format = 'org.hl7.fhir.api'): string { return this.v1Path(ctx, 'individual', format, 'Task', '_logs'); }

  public conversionUploadPath(ctx: RouteContext, softwareId: string, sourceFormat: string): string {
    return `/${encodePathSegment(ctx.tenantId)}/cds-${encodePathSegment(ctx.jurisdiction)}/v1/${encodePathSegment(ctx.sector)}/conversion/${encodePathSegment(softwareId)}/${encodePathSegment(sourceFormat)}/_upload`;
  }

  public conversionUploadPollPath(ctx: RouteContext, softwareId: string, sourceFormat: string): string {
    return `/${encodePathSegment(ctx.tenantId)}/cds-${encodePathSegment(ctx.jurisdiction)}/v1/${encodePathSegment(ctx.sector)}/conversion/${encodePathSegment(softwareId)}/${encodePathSegment(sourceFormat)}/_upload-response`;
  }

  public individualMedicationOverlapCheckPath(ctx: RouteContext): string {
    return this.v1Path(ctx, 'individual', 'org.hl7.fhir.api', 'MedicationStatement', '_overlap-check');
  }
}
