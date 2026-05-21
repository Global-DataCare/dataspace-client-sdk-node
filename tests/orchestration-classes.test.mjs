import test from 'node:test';
import assert from 'node:assert/strict';
import { PersonalSdk, ProfessionalSdk } from '../dist/index.js';

test('PersonalSdk delegates to DataspaceNodeClient methods', async () => {
  const calls = [];
  const fakeClient = {
    bootstrapIndividualOrganizationSimple: async (...args) => { calls.push(['bootstrapIndividualOrganizationSimple', args]); return { ok: true }; },
    grantProfessionalAccessSimple: async (...args) => { calls.push(['grantProfessionalAccessSimple', args]); return { ok: true }; },
    importIpsOrFhirAndUpdateIndex: async (...args) => { calls.push(['importIpsOrFhirAndUpdateIndex', args]); return { ok: true }; },
    ingestCommunicationAndUpdateIndex: async (...args) => { calls.push(['ingestCommunicationAndUpdateIndex', args]); return { ok: true }; },
    generateDigitalTwinFromSubjectData: async (...args) => { calls.push(['generateDigitalTwinFromSubjectData', args]); return { ok: true }; },
    requestSmartTokenSimple: async (...args) => { calls.push(['requestSmartTokenSimple', args]); return { ok: true }; },
    submitAndPoll: async (...args) => { calls.push(['submitAndPoll', args]); return { ok: true }; },
  };
  const sdk = new PersonalSdk(fakeClient);
  await sdk.bootstrapIndividualOrganizationSimple({});
  await sdk.grantProfessionalAccessSimple({});
  await sdk.requestSmartTokenSimple({});
  assert.equal(calls.length, 3);
});

test('ProfessionalSdk delegates to DataspaceNodeClient methods', async () => {
  const calls = [];
  const fakeClient = {
    activateOrganizationInGatewayFromIcaProof: async (...args) => { calls.push(['activateOrganizationInGatewayFromIcaProof', args]); return { ok: true }; },
    createOrganizationEmployee: async (...args) => { calls.push(['createOrganizationEmployee', args]); return { ok: true }; },
    activateEmployeeDeviceWithActivationCodeSimple: async (...args) => { calls.push(['activateEmployeeDeviceWithActivationCodeSimple', args]); return { ok: true }; },
    requestSmartTokenSimple: async (...args) => { calls.push(['requestSmartTokenSimple', args]); return { ok: true }; },
    ingestCommunicationAndUpdateIndex: async (...args) => { calls.push(['ingestCommunicationAndUpdateIndex', args]); return { ok: true }; },
    grantProfessionalAccessSimple: async (...args) => { calls.push(['grantProfessionalAccessSimple', args]); return { ok: true }; },
    submitAndPoll: async (...args) => { calls.push(['submitAndPoll', args]); return { ok: true }; },
  };
  const sdk = new ProfessionalSdk(fakeClient);
  await sdk.createOrganizationEmployee({}, {});
  await sdk.activateEmployeeDeviceWithActivationCodeSimple({});
  await sdk.requestSmartTokenSimple({});
  assert.equal(calls.length, 3);
});

test('actor facades keep role-scoped surface separation', async () => {
  assert.equal(typeof ProfessionalSdk.prototype.bootstrapIndividualOrganizationSimple, 'undefined');
  assert.equal(typeof ProfessionalSdk.prototype.generateDigitalTwinFromSubjectData, 'undefined');
  assert.equal(typeof PersonalSdk.prototype.activateOrganizationInGatewayFromIcaProof, 'undefined');
  assert.equal(typeof PersonalSdk.prototype.createOrganizationEmployee, 'undefined');
});
