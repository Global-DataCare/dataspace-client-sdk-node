import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActorSession,
  HostOnboardingSdk,
  IndividualControllerSdk,
  IndividualMemberSdk,
  OrganizationControllerSdk,
  OrganizationEmployeeSdk,
  ProfessionalSdk,
} from '../dist/index.js';

test('ActorSession creates the expected actor facade for each actor kind', async () => {
  const fakeClient = {};

  assert.ok(new ActorSession(fakeClient, { actorKind: 'host_onboarding' }).asHostOnboarding() instanceof HostOnboardingSdk);
  assert.ok(new ActorSession(fakeClient, { actorKind: 'organization_controller' }).asOrganizationController() instanceof OrganizationControllerSdk);
  assert.ok(new ActorSession(fakeClient, { actorKind: 'organization_employee' }).asOrganizationEmployee() instanceof OrganizationEmployeeSdk);
  assert.ok(new ActorSession(fakeClient, { actorKind: 'individual_controller' }).asIndividualController() instanceof IndividualControllerSdk);
  assert.ok(new ActorSession(fakeClient, { actorKind: 'individual_member' }).asIndividualMember() instanceof IndividualMemberSdk);
  assert.ok(new ActorSession(fakeClient, { actorKind: 'professional' }).asProfessional() instanceof ProfessionalSdk);
});

test('ActorSession rejects actor facade misuse', async () => {
  const fakeClient = {};
  const session = new ActorSession(fakeClient, { actorKind: 'organization_controller' });
  assert.throws(
    () => session.asProfessional(),
    /cannot be used as 'professional'/,
  );
});
