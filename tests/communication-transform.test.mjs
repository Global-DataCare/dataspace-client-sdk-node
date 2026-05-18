import test from 'node:test';
import assert from 'node:assert/strict';
import { transformCommunicationClaimsToResourceFhirR4 } from '../dist/index.js';

test('transformCommunicationClaimsToResourceFhirR4 maps 1:1 and preserves resource.meta.claims', () => {
  const claims = [{
    '@context': 'org.hl7.fhir.r4',
    'Communication.identifier': 'comm-001',
    'Communication.subject': 'did:web:subject.example',
    'Communication.recipient': 'did:web:recipient.example',
    'Communication.sender': 'did:web:sender.example',
    'Communication.part-of': 'urn:uuid:root-comm',
    'Communication.note': 'hello',
    'Communication.content-reference': 'DocumentReference/doc-1',
  }];

  const result = transformCommunicationClaimsToResourceFhirR4(claims);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.resources.length, 1);
  const resource = result.resources[0];
  assert.equal(resource.resourceType, 'Communication');
  assert.equal(resource.subject.reference, 'did:web:subject.example');
  assert.equal(resource.partOf[0].reference, 'urn:uuid:root-comm');
  assert.equal(resource.payload[0].contentReference.reference, 'DocumentReference/doc-1');
  assert.equal(resource.meta.claims['Communication.identifier'], 'comm-001');
});

test('transformCommunicationClaimsToResourceFhirR4 strict mode rejects multiple payload kinds', () => {
  assert.throws(() => transformCommunicationClaimsToResourceFhirR4([{
    'Communication.content-reference': 'DocumentReference/doc-1',
    'Communication.content-code': 'http://loinc.org|LP173418-7',
  }], { mode: 'strict' }));
});

test('transformCommunicationClaimsToResourceFhirR4 normalize mode keeps deterministic payload/note', () => {
  const result = transformCommunicationClaimsToResourceFhirR4([{
    'Communication.content-attachment-type': 'text/plain',
    'Communication.content-reference': 'DocumentReference/doc-1',
    'Communication.note': ['first', 'second'],
  }], { mode: 'normalize' });
  assert.equal(result.resources.length, 1);
  assert.ok(result.warnings.length >= 2);
  const resource = result.resources[0];
  assert.equal(resource.payload[0].contentAttachment.contentType, 'text/plain');
  assert.equal(resource.note[0].text, 'first');
});

test('transformCommunicationClaimsToResourceFhirR4 maps appointment reminder example to valid Communication shape', () => {
  const sent = '2025-10-15T14:30:00Z';
  const sourceUrl = 'https://url-to-appointment-source.com/some-uuid';
  const claims = [{
    '@context': 'org.hl7.fhir.r4',
    'Communication.category': 'http://terminology.hl7.org/CodeSystem/communication-category|appointment-reminder',
    'Communication.recipient': 'did:web:api.acme.org:individual:abc',
    'Communication.sender': 'did:web:hospital.example.com',
    'Communication.sent': sent,
    'Communication.subject': 'did:web:api.acme.org:individual:abc',
    'Communication.text': 'This is your new appointment. Best regards.',
    'Communication.content-reference': sourceUrl,
  }];

  const result = transformCommunicationClaimsToResourceFhirR4(claims, { mode: 'strict' });
  const resource = result.resources[0];
  assert.equal(resource.resourceType, 'Communication');
  assert.equal(resource.status, 'completed');
  assert.equal(resource.sent, sent);
  assert.equal(resource.recipient[0].reference, 'did:web:api.acme.org:individual:abc');
  assert.equal(resource.sender.reference, 'did:web:hospital.example.com');
  assert.equal(resource.subject.reference, 'did:web:api.acme.org:individual:abc');
  assert.equal(resource.payload[0].contentReference.reference, sourceUrl);
  assert.equal(resource.note[0].text, 'This is your new appointment. Best regards.');
  assert.equal(resource.category[0].coding[0].system, 'http://terminology.hl7.org/CodeSystem/communication-category');
  assert.equal(resource.category[0].coding[0].code, 'appointment-reminder');
});
