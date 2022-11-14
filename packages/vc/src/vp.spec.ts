// Copyright 2021-2022 zcloak authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { HexString } from '@zcloak/crypto/types';

import { generateMnemonic, initCrypto, randomAsHex } from '@zcloak/crypto';
import { Did, helpers } from '@zcloak/did';

import { Raw, VerifiableCredentialBuilder } from './credential';
import { DEFAULT_CONTEXT, DEFAULT_VP_HASH_TYPE, DEFAULT_VP_VERSION } from './defaults';
import { calcRoothash } from './rootHash';
import { hashDigests, VerifiablePresentationBuilder } from './vp';

const CONTENTS1 = {
  name: 'zCloak',
  age: 19,
  birthday: '2022.10.31',
  isUser: true
};
const CONTENTS2 = {
  No: 'E35557645365474',
  birthday: Date.now()
};
const CONTENTS3 = {
  levels: ['1', '2', '3']
};

describe('VerifiablePresentation', (): void => {
  const holder: Did = helpers.createEcdsaFromMnemonic(generateMnemonic(12));
  const issuer1: Did = helpers.createEcdsaFromMnemonic(generateMnemonic(12));
  const issuer2: Did = helpers.createEcdsaFromMnemonic(generateMnemonic(12));
  const issuer3: Did = helpers.createEcdsaFromMnemonic(generateMnemonic(12));
  const ctype1: HexString = randomAsHex(32);
  const ctype2: HexString = randomAsHex(32);
  const ctype3: HexString = randomAsHex(32);

  const rawCtype1 = new Raw({
    contents: CONTENTS1,
    owner: holder.id,
    ctype: ctype1,
    hashType: 'Rescue'
  });
  const rawCtype2 = new Raw({
    contents: CONTENTS2,
    owner: holder.id,
    ctype: ctype2,
    hashType: 'Rescue'
  });
  const rawCtype3 = new Raw({
    contents: CONTENTS3,
    owner: holder.id,
    ctype: ctype3,
    hashType: 'Rescue'
  });

  beforeAll(async (): Promise<void> => {
    await initCrypto();
    rawCtype1.calcRootHash();
    rawCtype2.calcRootHash();
    rawCtype3.calcRootHash();
  });

  describe('VerifiablePresentation single vc', (): void => {
    it('create ctype1 vp with VPType: VP', (): void => {
      const vc = VerifiableCredentialBuilder.fromRawCredential(rawCtype1.toRawCredential())
        .setExpirationDate(null)
        .build(issuer1);

      const vpBuilder = new VerifiablePresentationBuilder(holder);

      const vp = vpBuilder.addVC(vc, 'VP').build();

      expect(vp).toMatchObject({
        '@context': DEFAULT_CONTEXT,
        version: DEFAULT_VP_VERSION,
        type: ['VP'],
        verifiableCredential: [vc],
        id: hashDigests([vc.digest], DEFAULT_VP_HASH_TYPE).hash,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          proofPurpose: 'authentication'
        },
        hasher: [DEFAULT_VP_HASH_TYPE]
      });
    });

    it('create ctype1 vp with VPType: VP_Digest', (): void => {
      const vc = VerifiableCredentialBuilder.fromRawCredential(rawCtype1.toRawCredential())
        .setExpirationDate(null)
        .build(issuer1);

      const vpBuilder = new VerifiablePresentationBuilder(holder);

      const vp = vpBuilder.addVC(vc, 'VP_Digest').build();

      expect(vp).toMatchObject({
        '@context': DEFAULT_CONTEXT,
        version: DEFAULT_VP_VERSION,
        type: ['VP_Digest'],
        verifiableCredential: [
          {
            ...vc,
            credentialSubject: calcRoothash(CONTENTS1, vc.hasher[0], vc.credentialSubjectNonceMap)
              .rootHash,
            credentialSubjectHashes: [],
            credentialSubjectNonceMap: {}
          }
        ],
        id: hashDigests([vc.digest], DEFAULT_VP_HASH_TYPE).hash,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          proofPurpose: 'authentication'
        },
        hasher: [DEFAULT_VP_HASH_TYPE]
      });
    });

    it('create ctype1 vp with VPType: VP_SelectiveDisclosure', (): void => {
      const vc = VerifiableCredentialBuilder.fromRawCredential(rawCtype1.toRawCredential())
        .setExpirationDate(null)
        .build(issuer1);

      const vpBuilder = new VerifiablePresentationBuilder(holder);

      const vp = vpBuilder.addVC(vc, 'VP_SelectiveDisclosure', ['isUser']).build();

      expect(vp).toMatchObject({
        '@context': DEFAULT_CONTEXT,
        version: DEFAULT_VP_VERSION,
        type: ['VP_SelectiveDisclosure'],
        verifiableCredential: [
          {
            ...vc,
            credentialSubject: {
              isUser: true
            },
            credentialSubjectNonceMap: {
              [Object.keys(vc.credentialSubjectNonceMap)[3]]: Object.values(
                vc.credentialSubjectNonceMap
              )[3]
            }
          }
        ],
        id: hashDigests([vc.digest], DEFAULT_VP_HASH_TYPE).hash,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          proofPurpose: 'authentication'
        },
        hasher: [DEFAULT_VP_HASH_TYPE]
      });
    });
  });

  describe('VerifiablePresentation multi vc by ctype2', (): void => {
    it('create vp has multi ctype2 vc with VPType: VP', (): void => {
      const vc1 = VerifiableCredentialBuilder.fromRawCredential(rawCtype2.toRawCredential())
        .setExpirationDate(null)
        .build(issuer1);
      const vc2 = VerifiableCredentialBuilder.fromRawCredential(rawCtype2.toRawCredential())
        .setExpirationDate(null)
        .build(issuer2);

      const vpBuilder = new VerifiablePresentationBuilder(holder);

      const vp = vpBuilder.addVC(vc1, 'VP').addVC(vc2, 'VP').build();

      expect(vp).toMatchObject({
        '@context': DEFAULT_CONTEXT,
        version: DEFAULT_VP_VERSION,
        type: ['VP', 'VP'],
        verifiableCredential: [vc1, vc2],
        id: hashDigests([vc1.digest, vc2.digest], DEFAULT_VP_HASH_TYPE).hash,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          proofPurpose: 'authentication'
        },
        hasher: [DEFAULT_VP_HASH_TYPE]
      });
    });

    it('create vp has multi ctype2 vc with VPType: VP_Digest', (): void => {
      const vc1 = VerifiableCredentialBuilder.fromRawCredential(rawCtype2.toRawCredential())
        .setExpirationDate(null)
        .build(issuer1);
      const vc2 = VerifiableCredentialBuilder.fromRawCredential(rawCtype2.toRawCredential())
        .setExpirationDate(null)
        .build(issuer2);

      const vpBuilder = new VerifiablePresentationBuilder(holder);

      const vp = vpBuilder.addVC(vc1, 'VP_Digest').addVC(vc2, 'VP_Digest').build();

      expect(vp).toMatchObject({
        '@context': DEFAULT_CONTEXT,
        version: DEFAULT_VP_VERSION,
        type: ['VP_Digest', 'VP_Digest'],
        verifiableCredential: [
          {
            ...vc1,
            credentialSubject: calcRoothash(CONTENTS2, vc1.hasher[0], vc1.credentialSubjectNonceMap)
              .rootHash,
            credentialSubjectHashes: [],
            credentialSubjectNonceMap: {}
          },
          {
            ...vc2,
            credentialSubject: calcRoothash(CONTENTS2, vc2.hasher[0], vc2.credentialSubjectNonceMap)
              .rootHash,
            credentialSubjectHashes: [],
            credentialSubjectNonceMap: {}
          }
        ],
        id: hashDigests([vc1.digest, vc2.digest], DEFAULT_VP_HASH_TYPE).hash,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          proofPurpose: 'authentication'
        },
        hasher: [DEFAULT_VP_HASH_TYPE]
      });
    });

    it('create vp has multi ctype2 vc with VPType: VP_SelectiveDisclosure', (): void => {
      const vc1 = VerifiableCredentialBuilder.fromRawCredential(rawCtype2.toRawCredential())
        .setExpirationDate(null)
        .build(issuer1);
      const vc2 = VerifiableCredentialBuilder.fromRawCredential(rawCtype2.toRawCredential())
        .setExpirationDate(null)
        .build(issuer2);

      const vpBuilder = new VerifiablePresentationBuilder(holder);

      const vp = vpBuilder
        .addVC(vc1, 'VP_SelectiveDisclosure', ['birthday'])
        .addVC(vc2, 'VP_SelectiveDisclosure', ['No'])
        .build();

      expect(vp).toMatchObject({
        '@context': DEFAULT_CONTEXT,
        version: DEFAULT_VP_VERSION,
        type: ['VP_SelectiveDisclosure', 'VP_SelectiveDisclosure'],
        verifiableCredential: [
          {
            ...vc1,
            credentialSubject: {
              birthday: CONTENTS2.birthday
            },
            credentialSubjectNonceMap: {
              [Object.keys(vc1.credentialSubjectNonceMap)[1]]: Object.values(
                vc1.credentialSubjectNonceMap
              )[1]
            }
          },
          {
            ...vc2,
            credentialSubject: {
              No: CONTENTS2.No
            },
            credentialSubjectNonceMap: {
              [Object.keys(vc2.credentialSubjectNonceMap)[0]]: Object.values(
                vc2.credentialSubjectNonceMap
              )[0]
            }
          }
        ],
        id: hashDigests([vc1.digest, vc2.digest], DEFAULT_VP_HASH_TYPE).hash,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          proofPurpose: 'authentication'
        },
        hasher: [DEFAULT_VP_HASH_TYPE]
      });
    });
  });

  describe('VerifiablePresentation multi vc by multi ctypes', (): void => {
    it('create vp has multi ctypes vc with multi VPType', (): void => {
      const vc1 = VerifiableCredentialBuilder.fromRawCredential(rawCtype1.toRawCredential())
        .setExpirationDate(null)
        .build(issuer1);
      const vc2 = VerifiableCredentialBuilder.fromRawCredential(rawCtype2.toRawCredential())
        .setExpirationDate(null)
        .build(issuer2);
      const vc3 = VerifiableCredentialBuilder.fromRawCredential(rawCtype3.toRawCredential())
        .setExpirationDate(null)
        .build(issuer3);

      const vpBuilder = new VerifiablePresentationBuilder(holder);

      const vp = vpBuilder
        .addVC(vc1, 'VP_Digest')
        .addVC(vc2, 'VP_SelectiveDisclosure', ['No'])
        .addVC(vc3, 'VP')
        .build();

      expect(vp).toMatchObject({
        '@context': DEFAULT_CONTEXT,
        version: DEFAULT_VP_VERSION,
        type: ['VP_Digest', 'VP_SelectiveDisclosure', 'VP'],
        verifiableCredential: [
          {
            ...vc1,
            credentialSubject: calcRoothash(CONTENTS1, vc1.hasher[0], vc1.credentialSubjectNonceMap)
              .rootHash,
            credentialSubjectHashes: [],
            credentialSubjectNonceMap: {}
          },
          {
            ...vc2,
            credentialSubject: {
              No: CONTENTS2.No
            },
            credentialSubjectNonceMap: {
              [Object.keys(vc2.credentialSubjectNonceMap)[0]]: Object.values(
                vc2.credentialSubjectNonceMap
              )[0]
            }
          },
          vc3
        ],
        id: hashDigests([vc1.digest, vc2.digest, vc3.digest], DEFAULT_VP_HASH_TYPE).hash,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          proofPurpose: 'authentication'
        },
        hasher: [DEFAULT_VP_HASH_TYPE]
      });
    });
  });
});