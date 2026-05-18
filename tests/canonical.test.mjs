import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLoincI18nKey,
  buildLoincToken,
  normalizeContextualClaims,
} from '../dist/index.js';

test('buildLoincToken and buildLoincI18nKey emit canonical LOINC forms', () => {
  assert.equal(buildLoincToken('48765-2'), 'LOINC|48765-2');
  assert.equal(buildLoincToken('  LOINC|10160-0  '), 'LOINC|10160-0');
  assert.equal(buildLoincI18nKey('48765-2'), 'org.loinc.48765-2');
  assert.equal(buildLoincI18nKey('  org.loinc.10160-0  '), 'org.loinc.10160-0');
});

test('normalizeContextualClaims prefixes contextual keys without rewriting fully-qualified keys', () => {
  const claims = normalizeContextualClaims({
    '@context': 'org.schema',
    status: 'scheduled',
    subject: 'did:web:subject.example.com',
    'org.schema.Organization.owner.telephone': '+15551234567',
    '@id': 'urn:uuid:claim-001',
  });

  assert.deepEqual(claims, {
    '@context': 'org.schema',
    'org.schema.status': 'scheduled',
    'org.schema.subject': 'did:web:subject.example.com',
    'org.schema.Organization.owner.telephone': '+15551234567',
    '@id': 'urn:uuid:claim-001',
  });
});

