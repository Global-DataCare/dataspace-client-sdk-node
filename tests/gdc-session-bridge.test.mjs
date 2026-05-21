import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createActorSessionFromGdcFacade,
  createActorSessionFromGdcDescriptor,
  createActorSessionsFromGdcFacades,
  createActorSessionsFromGdcDescriptor,
} from '../dist/gdc-session-bridge.js';

test('createActorSessionsFromGdcDescriptor expands a family descriptor into multiple actor sessions with scoped capabilities', () => {
  const descriptor = {
    actorKinds: ['individual_controller', 'individual_member'],
    capabilities: [
      'individual.bootstrap',
      'individual.import_ips',
      'individual.generate_digital_twin',
      'consent.grant_professional_access',
    ],
    appType: 'Family',
    profileId: 'profile-family-1',
    profileDid: 'did:web:family:controller',
    role: 'controller',
  };

  const sessions = createActorSessionsFromGdcDescriptor({}, descriptor);

  assert.equal(sessions.length, 2);
  const controller = sessions.find(session => session.actorKind === 'individual_controller');
  const member = sessions.find(session => session.actorKind === 'individual_member');

  assert.ok(controller);
  assert.ok(member);
  assert.deepEqual(controller.capabilities.slice().sort(), [
    'consent.grant_professional_access',
    'individual.bootstrap',
  ]);
  assert.deepEqual(member.capabilities.slice().sort(), [
    'individual.generate_digital_twin',
    'individual.import_ips',
  ]);
  assert.equal(controller.actorDid, 'did:web:family:controller');
});

test('createActorSessionFromGdcDescriptor selects one actor facade contract explicitly', () => {
  const descriptor = {
    actorKinds: ['organization_controller'],
    capabilities: [
      'organization.create_employee',
      'organization.issue_activation_code',
      'organization.request_smart_token',
    ],
    appType: 'Organization',
    profileId: 'profile-org-1',
    profileDid: 'did:web:org:controller',
    role: 'ISCO-08|1120',
  };

  const session = createActorSessionFromGdcDescriptor({}, descriptor, 'organization_controller');

  assert.equal(session.actorKind, 'organization_controller');
  assert.deepEqual(session.capabilities, [
    'organization.create_employee',
    'organization.request_smart_token',
  ]);
});

test('createActorSessionFromGdcDescriptor rejects actor kinds not exposed by the descriptor', () => {
  const descriptor = {
    actorKinds: ['professional'],
    capabilities: ['professional.medication'],
    appType: 'Organization',
    profileId: 'profile-prof-1',
  };

  assert.throws(
    () => createActorSessionFromGdcDescriptor({}, descriptor, 'organization_controller'),
    /does not expose actor kind 'organization_controller'/,
  );
});

test('createActorSessionsFromGdcFacades preserves already-separated facade capabilities', () => {
  const sessions = createActorSessionsFromGdcFacades({}, [
    {
      actorKind: 'individual_controller',
      capabilities: ['individual.bootstrap', 'consent.grant_professional_access'],
      appType: 'Family',
      profileId: 'profile-family-1',
      profileDid: 'did:web:family:controller',
    },
    {
      actorKind: 'individual_member',
      capabilities: ['individual.import_ips', 'individual.generate_digital_twin'],
      appType: 'Family',
      profileId: 'profile-family-1',
      profileDid: 'did:web:family:controller',
    },
  ]);

  assert.deepEqual(
    sessions.map(session => [session.actorKind, session.capabilities]),
    [
      ['individual_controller', ['individual.bootstrap', 'consent.grant_professional_access']],
      ['individual_member', ['individual.import_ips', 'individual.generate_digital_twin']],
    ],
  );
});

test('createActorSessionFromGdcFacade filters out foreign capabilities defensively', () => {
  const session = createActorSessionFromGdcFacade({}, {
    actorKind: 'organization_controller',
    capabilities: [
      'organization.create_employee',
      'organization.issue_activation_code',
      'individual.import_ips',
    ],
    appType: 'Organization',
    profileId: 'profile-org-1',
  });

  assert.deepEqual(session.capabilities, ['organization.create_employee']);
});
