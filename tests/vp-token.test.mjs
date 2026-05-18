import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLegalRepresentativeCredential,
  addOrganizationCredential,
  addVCs,
  createVP,
} from '../dist/index.js';

function vcJwt(type) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    type: ['VerifiableCredential', type],
    credentialSubject: { id: 'did:web:subject.example.org' },
  })).toString('base64url');
  return `${header}.${payload}.sig`;
}

test('addVCs appends one or many VC jwt strings', () => {
  const vp = createVP({ iss: 'did:web:holder.example.org' });
  addVCs(vp, [vcJwt('OrganizationCredential'), vcJwt('LegalRepresentativeCredential')]);
  assert.equal(vp.vp.verifiableCredential.length, 2);
});

test('addOrganizationCredential validates VC type', () => {
  const vp = createVP({ iss: 'did:web:holder.example.org' });
  addOrganizationCredential(vp, vcJwt('OrganizationCredential'));
  assert.equal(vp.vp.verifiableCredential.length, 1);
  assert.throws(
    () => addOrganizationCredential(vp, vcJwt('LegalRepresentativeCredential')),
    /Organization VC must include one of types/,
  );
});

test('addLegalRepresentativeCredential validates VC type', () => {
  const vp = createVP({ iss: 'did:web:holder.example.org' });
  addLegalRepresentativeCredential(vp, vcJwt('LegalRepresentativeCredential'));
  assert.equal(vp.vp.verifiableCredential.length, 1);
  assert.throws(
    () => addLegalRepresentativeCredential(vp, vcJwt('OrganizationCredential')),
    /LegalRepresentative VC must include one of types/,
  );
});

