// Copyright 2021-2022 zcloak authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Did } from '@zcloak/did';
import type { Proof, RawCredential, VerifiableCredential } from '../types';

import { assert } from '@polkadot/util';

import { base58Encode } from '@zcloak/crypto';

import { keyTypeToSignatureType } from '../utils';
import { Base } from './base';
import { calcDigest } from './digest';
import { calcRoothash } from './rootHash';
import { ICredential } from './type';

/**
 * A class implements [[ICredential]]
 *
 * Use the class, you can generate a credential, and calc `rootHash`, get a `digest`, and attester can sign a proof to this.
 *
 * @example
 * ```typescript
 * import { helpers, Did } from '@zcloak/did'
 * import { Credential } from '@zcloak/vc';
 *
 * const credential = new Credential();
 * credential.setContext();
 * credential.setCtype();
 * credential.setIssuanceDate();
 * credential.setExpirationDate();
 * credential.setCredentialSubject();
 * credential.setIssuer();
 * credential.setHolder();
 *
 * const mnemonic = 'health correct setup usage father decorate curious copper sorry recycle skin equal';
 * const keyring: Keyring = new Keyring();
 * const did: Did = helpers.createEcdsaFromMnemonic(mnemonic, keyring);
 * credential.signProof(did, did.assertionMethod.values[0]);
 * ```
 */
export class Credential extends Base {
  public static fromCredential(input: ICredential): Credential {
    const credential = new Credential();

    credential.setContext(input.context);
    credential.setCtype(input.ctype);
    credential.setIssuanceDate(input.issuanceDate);
    credential.setExpirationDate(input.expirationDate);
    credential.setCredentialSubject(input.credentialSubject);
    credential.setIssuer(input.issuer);
    credential.setHolder(input.holder);
    credential.setDigest(input.digest);
    credential.setProof(input.proof);

    return credential;
  }

  /**
   * sign and add a [[Proof]]
   * @param did The [[Did]] instance
   */
  public signProof(did: Did): void {
    assert(this.credentialSubject, 'credentialSubject is null');
    assert(this.holder, 'holder is null');
    assert(this.ctype, 'ctype is null');

    const { rootHash } = calcRoothash(this.credentialSubject, this.hashType);
    const { digest, type } = calcDigest(
      {
        rootHash,
        expirationDate: this.expirationDate,
        holder: this.holder,
        ctype: this.ctype
      },
      this.hashType
    );
    const { didUrl, signature, type: keyType } = did.signWithKey('assertionMethod', digest);

    const proof: Proof = {
      type: `${type}+${keyTypeToSignatureType(keyType)}`,
      created: Date.now(),
      verificationMethod: didUrl,
      proofPurpose: 'assertionMethod',
      proofValue: base58Encode(signature)
    };

    this.setDigest(digest);
    this.setProof(proof);
  }

  /**
   * serialize to [[RawCredential]] json
   */
  public getRawCredential(): RawCredential {
    if (
      this.context &&
      this.ctype &&
      this.issuanceDate &&
      this.credentialSubject &&
      this.issuer &&
      this.holder
    ) {
      const { hashes, nonceMap } = calcRoothash(this.credentialSubject, this.hashType);

      return {
        '@context': this.context,
        version: '0',
        ctype: this.ctype,
        issuanceDate: this.issuanceDate,
        expirationDate: this.expirationDate,
        credentialSubject: this.credentialSubject,
        credentialSubjectHashes: hashes,
        credentialSubjectNonceMap: nonceMap,
        issuer: [this.issuer],
        holder: this.holder
      };
    }

    throw new Error('Not to serialize RawCredential');
  }

  public getVC(): VerifiableCredential {
    const raw: RawCredential = this.getRawCredential();

    if (this.digest && this.proof) {
      return {
        ...raw,
        digest: this.digest,
        proof: [this.proof]
      };
    }

    throw new Error('Please sign a proof, or set Digest and proof');
  }
}