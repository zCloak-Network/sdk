// Copyright 2021-2023 zcloak authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { HexString } from '@polkadot/util/types';
import type { CType } from '@zcloak/ctype/types';
import type { Did } from '@zcloak/did';
import type { DidUrl } from '@zcloak/did-resolver/types';
import type { HashType, Proof, RawCredential, VerifiableCredential, VerifiableCredentialVersion } from '../types';

import { assert } from '@polkadot/util';

import { base58Encode } from '@zcloak/crypto';

import { DEFAULT_CONTEXT, DEFAULT_VC_VERSION } from '../defaults';
import { calcDigest, DigestPayload } from '../digest';
import { isRawCredential } from '../is';
import { calcRoothash, RootHashResult } from '../rootHash';
import { signedVCMessage } from '../utils';
import { Raw } from './raw';

/**
 * @name VerifiableCredentialBuilder
 *
 * @description
 * A builder to make [[VerifiableCredential]] for attester.
 *
 * Use this builder to set attributes for [[VerifiableCredential]], and sign proof for [[VerifiableCredential]]
 *
 * @example
 * ```typescript
 * import { Did, helpers } from '@zcloak/did';
 * import { DEFAULT_ROOT_HASH_TYPE } from '@zcloak/defaults';
 * import { VerifiableCredential } from '@zcloak/types';
 * import { Raw } from '@zcloak/vc';
 * import { VerifiableCredentialBuilder } from './vc';
 *
 * const raw = new Raw({
 *   contents: {},
 *   hashType: DEFAULT_ROOT_HASH_TYPE,
 *   ctype: '0x...',
 *   owner: 'did:zk:claimer'
 * });
 *
 *
 * const builder = VerifiableCredentialBuilder.fromRaw(raw)
 *   .setExpirationDate(null); // if you don't want the vc to expirate, set it to `null`
 *
 * const issuer: Did = helpers.createEcdsaFromMnemonic('pass your mnemonic')
 * const vc: VerifiableCredential = builder.build(issuer)
 * ```
 */
export class VerifiableCredentialBuilder {
  public '@context'?: string[];
  public version?: VerifiableCredentialVersion;
  public issuanceDate?: number;
  public expirationDate?: number | null;
  public raw: Raw;
  public digestHashType?: HashType;

  /**
   * instance by [[RawCredential]]
   */
  public static fromRawCredential(rawCredential: RawCredential, ctype: CType): VerifiableCredentialBuilder {
    assert(isRawCredential(rawCredential), 'input is not a RawCredential object');
    assert(ctype.$id === rawCredential.ctype, '`ctype` is not the raw credential ctype');

    const raw = Raw.fromRawCredential(rawCredential, ctype);
    const builder = new VerifiableCredentialBuilder(raw);

    return builder
      .setContext(DEFAULT_CONTEXT)
      .setVersion(DEFAULT_VC_VERSION)
      .setIssuanceDate(Date.now())
      .setDigestHashType(rawCredential.hasher[1]);
  }

  constructor(raw: Raw) {
    this.raw = raw;
  }

  /**
   * Build to [[PublicVerifiableCredential]]
   */
  public async build(issuer: Did, isPublic: true): Promise<VerifiableCredential<true>>;

  /**
   * Build to [[PrivateVerifiableCredential]]
   */
  public async build(issuer: Did, isPublic?: false): Promise<VerifiableCredential<false>>;

  public async build(issuer: Did, isPublic?: boolean): Promise<VerifiableCredential<boolean>> {
    assert(this.raw.checkSubject(), `Subject check failed when use ctype ${this.raw.ctype}`);

    if (
      this['@context'] &&
      this.version &&
      this.issuanceDate &&
      this.digestHashType &&
      this.expirationDate !== undefined
    ) {
      let rootHashResult: RootHashResult;

      if (isPublic) {
        rootHashResult = calcRoothash(this.raw.contents, this.raw.hashType);
      } else {
        rootHashResult = calcRoothash(this.raw.contents, this.raw.hashType, {});
      }

      const digestPayload: DigestPayload<VerifiableCredentialVersion> = {
        rootHash: rootHashResult.rootHash,
        expirationDate: this.expirationDate || undefined,
        holder: this.raw.owner,
        ctype: this.raw.ctype.$id,
        issuanceDate: this.issuanceDate
      };

      const { digest, type: digestHashType } = calcDigest(this.version, digestPayload, this.digestHashType);

      const proof = await this._signDigest(issuer, digest, this.version);

      let vc: VerifiableCredential<boolean> = {
        '@context': this['@context'],
        version: this.version,
        ctype: this.raw.ctype.$id,
        issuanceDate: this.issuanceDate,
        credentialSubject: this.raw.contents,
        issuer: issuer.id,
        holder: this.raw.owner,
        hasher: [rootHashResult.type, digestHashType],
        digest,
        proof: [proof]
      };

      if (!isPublic) {
        vc = {
          ...vc,
          credentialSubjectHashes: rootHashResult.hashes,
          credentialSubjectNonceMap: rootHashResult.nonceMap
        };
      }

      if (this.expirationDate) {
        vc.expirationDate = this.expirationDate;
      }

      return vc;
    }

    throw new Error('Can not to build an VerifiableCredential');
  }

  /**
   * set arrtibute `@context`
   */
  public setContext(context: string[]): this {
    this['@context'] = context;

    return this;
  }

  /**
   * set arrtibute `version`
   */
  public setVersion(version: VerifiableCredentialVersion): this {
    this.version = version;

    return this;
  }

  /**
   * set arrtibute `issuanceDate`
   */
  public setIssuanceDate(timestamp: number): this {
    this.issuanceDate = timestamp;

    return this;
  }

  /**
   * set arrtibute `expirationDate`, if you want to set the expiration date, pass `null` to this method.
   */
  public setExpirationDate(timestamp: number | null): this {
    this.expirationDate = timestamp;

    return this;
  }

  /**
   * set arrtibute `raw`
   * @param rawIn instance of [[Raw]]
   */
  public setRaw(rawIn: Raw): this {
    this.raw = rawIn;

    return this;
  }

  /**
   * set attribute `digestHashType`
   */
  public setDigestHashType(hashType: HashType): this {
    this.digestHashType = hashType;

    return this;
  }

  // sign digest by did, the signed message is `concat('CredentialVersionedDigest', version, digest)`
  private async _signDigest(did: Did, digest: HexString, version: VerifiableCredentialVersion): Promise<Proof> {
    let message: Uint8Array | HexString;

    if (version === '1') {
      message = signedVCMessage(digest, version);
    } else {
      message = digest;
    }

    const signDidUrl: DidUrl = did.getKeyUrl('assertionMethod');

    const { id, signature, type: signType } = await did.signWithKey(message, signDidUrl);

    return {
      type: signType,
      created: Date.now(),
      verificationMethod: id,
      proofPurpose: 'assertionMethod',
      proofValue: base58Encode(signature)
    };
  }
}
