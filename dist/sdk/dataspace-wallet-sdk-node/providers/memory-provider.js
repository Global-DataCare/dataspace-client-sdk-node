import { createCipheriv, createDecipheriv, createHash, createPublicKey, generateKeyPairSync, randomBytes, sign as cryptoSign, verify as cryptoVerify, } from 'node:crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
function contextKey(context) {
    return [context.tenantId, context.jurisdiction, context.sector, context.walletId ?? 'default'].join(':');
}
function normalizeBytes(input) {
    return typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
}
function toBase64Url(buffer) {
    return Buffer.from(buffer).toString('base64url');
}
function fromBase64Url(value) {
    return Buffer.from(value, 'base64url');
}
function encodeJsonBase64Url(value) {
    return toBase64Url(Buffer.from(JSON.stringify(value), 'utf8'));
}
function buildKid(context, jwk) {
    const thumbprint = createHash('sha256')
        .update(JSON.stringify({
        crv: jwk.crv,
        e: jwk.e,
        kty: jwk.kty,
        n: jwk.n,
        x: jwk.x,
        y: jwk.y,
    }))
        .digest('base64url')
        .slice(0, 16);
    return `wallet:${context.tenantId}:${context.jurisdiction}:${context.sector}:${thumbprint}`;
}
function buildPrivateKeyRef(kid, algorithm) {
    return {
        kid,
        kind: 'managed',
        algorithm,
    };
}
function buildSigningKeyPair(context) {
    const generated = generateKeyPairSync('ec', {
        namedCurve: 'secp384r1',
    });
    const publicJwk = generated.publicKey.export({ format: 'jwk' });
    const kid = buildKid(context, publicJwk);
    const normalizedPublicJwk = {
        ...publicJwk,
        kid,
        alg: 'ES384',
        use: 'sig',
        key_ops: ['verify'],
    };
    return {
        publicJwk: normalizedPublicJwk,
        publicKey: createPublicKey({ key: normalizedPublicJwk, format: 'jwk' }),
        privateKey: generated.privateKey,
        privateKeyRef: buildPrivateKeyRef(kid, 'ES384'),
    };
}
/** Generate a ML-KEM-768 key pair for content-key encapsulation (JWE `encrypted_key`). */
function buildMlKemEncryptionKeyPair(context) {
    const seed = randomBytes(64);
    const { publicKey: publicKeyBytes, secretKey: secretKeyBytes } = ml_kem768.keygen(seed);
    const x = toBase64Url(publicKeyBytes);
    const kid = createHash('sha256')
        .update(JSON.stringify({ crv: 'ML-KEM-768', kty: 'OKP', x }))
        .digest('base64url')
        .slice(0, 16);
    const fullKid = `wallet:${context.tenantId}:${context.jurisdiction}:${context.sector}:${kid}`;
    const publicJwk = {
        kty: 'OKP',
        crv: 'ML-KEM-768',
        x,
        kid: fullKid,
        alg: 'ML-KEM-768',
        use: 'enc',
        key_ops: ['wrapKey'],
    };
    return {
        publicJwk,
        secretKeyBytes,
        privateKeyRef: buildPrivateKeyRef(fullKid, 'ML-KEM-768'),
    };
}
export class MemoryWalletProvider {
    kind = 'mem';
    keysByContext = new Map();
    init(options) {
        for (const context of options?.contexts ?? []) {
            this.ensureKeyPair(context);
        }
    }
    async getPublicJwks(context) {
        const pair = this.ensureKeyPair(context);
        return [pair.signingPublicJwk, pair.encryptionPublicJwk];
    }
    async sign(payload, context, options) {
        const pair = this.selectSigningKeyPair(context, options?.keyId);
        const signature = cryptoSign('sha384', normalizeBytes(payload), pair.signingPrivateKey);
        return toBase64Url(signature);
    }
    async verify(payload, signature, jwk, _options) {
        const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
        return cryptoVerify('sha384', normalizeBytes(payload), publicKey, fromBase64Url(signature));
    }
    async signCompactJws(context, params) {
        const pair = this.selectSigningKeyPair(context, params.header.kid);
        const header = {
            ...params.header,
            alg: params.header.alg || 'ES384',
            kid: params.header.kid || pair.signingPublicJwk.kid,
        };
        const signingInput = `${encodeJsonBase64Url(header)}.${encodeJsonBase64Url(params.claims)}`;
        const signature = cryptoSign('sha384', Buffer.from(signingInput, 'ascii'), pair.signingPrivateKey);
        return `${signingInput}.${toBase64Url(signature)}`;
    }
    async encrypt(plaintext, recipientJwk, options) {
        // Delegate to buildCompactJwe; returns a compact JWE string.
        return this.buildCompactJwe(undefined, {
            plaintext,
            recipientJwk,
        });
    }
    async decrypt(ciphertext, context, options) {
        // ciphertext is a compact JWE produced by encrypt / buildCompactJwe.
        return this.decryptCompactJwe(ciphertext, context);
    }
    ensureKeyPair(context) {
        const key = contextKey(context);
        const existing = this.keysByContext.get(key);
        if (existing) {
            return existing;
        }
        const signingKeyPair = buildSigningKeyPair(context);
        const encryptionKeyPair = buildMlKemEncryptionKeyPair(context);
        const pair = {
            signingPublicJwk: signingKeyPair.publicJwk,
            signingPublicKey: signingKeyPair.publicKey,
            signingPrivateKey: signingKeyPair.privateKey,
            signingPrivateKeyRef: signingKeyPair.privateKeyRef,
            encryptionPublicJwk: encryptionKeyPair.publicJwk,
            mlKemSecretKeyBytes: encryptionKeyPair.secretKeyBytes,
            encryptionPrivateKeyRef: encryptionKeyPair.privateKeyRef,
        };
        this.keysByContext.set(key, pair);
        return pair;
    }
    selectSigningKeyPair(context, keyId) {
        const pair = this.ensureKeyPair(context);
        if (keyId && pair.signingPrivateKeyRef.kid !== keyId) {
            throw new Error(`Wallet key not found for kid: ${keyId}`);
        }
        return pair;
    }
    selectEncryptionKeyPair(context, keyId) {
        const pair = this.ensureKeyPair(context);
        if (keyId && pair.encryptionPrivateKeyRef.kid !== keyId) {
            throw new Error(`Wallet key not found for kid: ${keyId}`);
        }
        return pair;
    }
    async signDetachedJws(context, params) {
        const pair = this.selectSigningKeyPair(context, params.header.kid);
        const header = {
            ...params.header,
            alg: params.header.alg || 'ES384',
            kid: params.header.kid || pair.signingPublicJwk.kid,
            b64: false,
            crit: ['b64'],
        };
        const payloadBytes = normalizeBytes(params.payload);
        const encodedHeader = encodeJsonBase64Url(header);
        const signingInput = Buffer.concat([Buffer.from(`${encodedHeader}.`, 'ascii'), payloadBytes]);
        const signature = cryptoSign('sha384', signingInput, pair.signingPrivateKey);
        return `${encodedHeader}..${toBase64Url(signature)}`;
    }
    async buildCompactJwe(context, params) {
        const kid = params.recipientJwk.kid;
        const header = {
            alg: 'ML-KEM-768',
            enc: 'A256GCM',
            ...(params.contentType ? { cty: params.contentType } : {}),
            ...(kid ? { kid } : {}),
        };
        const encodedHeader = encodeJsonBase64Url(header);
        // ML-KEM-768: encapsulate derives a 32-byte CEK and produces a cipherText (1088 bytes)
        // that the recipient can decapsulate with their secret key.
        const publicKeyBytes = fromBase64Url(params.recipientJwk.x);
        const { cipherText: encapsulatedKey, sharedSecret: cek } = ml_kem768.encapsulate(publicKeyBytes);
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', cek, iv);
        cipher.setAAD(Buffer.from(encodedHeader, 'ascii'));
        const ciphertext = Buffer.concat([cipher.update(normalizeBytes(params.plaintext)), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return [
            encodedHeader,
            toBase64Url(encapsulatedKey),
            toBase64Url(iv),
            toBase64Url(ciphertext),
            toBase64Url(authTag),
        ].join('.');
    }
    async decryptCompactJwe(jwe, context) {
        const parts = jwe.split('.');
        if (parts.length !== 5) {
            throw new Error('Invalid compact JWE: expected 5 parts.');
        }
        const [encodedHeader, encapsulatedKeyB64, ivB64, ciphertextB64, tagB64] = parts;
        const pair = this.selectEncryptionKeyPair(context);
        // Recover CEK by decapsulating the ML-KEM ciphertext with the secret key.
        const cek = ml_kem768.decapsulate(fromBase64Url(encapsulatedKeyB64), pair.mlKemSecretKeyBytes);
        const decipher = createDecipheriv('aes-256-gcm', cek, fromBase64Url(ivB64));
        decipher.setAAD(Buffer.from(encodedHeader, 'ascii'));
        decipher.setAuthTag(fromBase64Url(tagB64));
        return Buffer.concat([decipher.update(fromBase64Url(ciphertextB64)), decipher.final()]);
    }
}
