// CompactJweHeader is used transitively through WalletProvider
export class WalletClient {
    provider;
    context;
    constructor(provider, context) {
        this.provider = provider;
        this.context = context;
    }
    getPublicJwks() {
        return this.provider.getPublicJwks(this.context);
    }
    sign(payload, options) {
        return this.provider.sign(payload, this.context, options);
    }
    verify(payload, signature, jwk, options) {
        return this.provider.verify(payload, signature, jwk, options);
    }
    signCompactJws(params) {
        return this.provider.signCompactJws(this.context, params);
    }
    signDetachedJws(params) {
        return this.provider.signDetachedJws(this.context, params);
    }
    buildCompactJwe(params) {
        return this.provider.buildCompactJwe(this.context, params);
    }
    decryptCompactJwe(jwe) {
        return this.provider.decryptCompactJwe(jwe, this.context);
    }
    encrypt(plaintext, recipientJwk, options) {
        return this.provider.encrypt(plaintext, recipientJwk, options);
    }
    decrypt(ciphertext, options) {
        return this.provider.decrypt(ciphertext, this.context, options);
    }
}
