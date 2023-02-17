// Copyright 2021-2023 zcloak authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { HexString } from '@zcloak/crypto/types';
import type { DidDocument } from '@zcloak/did-resolver/types';
import type { Proof } from '@zcloak/vc/types';

import { decodeMultibase } from '@zcloak/crypto';
import { DidResolver } from '@zcloak/did-resolver';

import { didVerify } from './didVerify';

/**
 * @name proofVerify
 * @summary Verifies the proof on the message.
 * @description
 * Verifies the `proof.proofValue` on the `message` with the `proof.verificationMethod`. `true` on success, `false` otherwise.
 *
 * @see [[didVerify]] about `resolverOrDidDocument`
 */
export async function proofVerify(
  message: HexString | Uint8Array,
  proof: Proof,
  resolverOrDidDocument?: DidDocument | DidResolver
): Promise<boolean> {
  const { proofValue, verificationMethod } = proof;

  const signature = decodeMultibase(proofValue);

  if (!resolverOrDidDocument) {
    return didVerify(message, signature, proof.type, verificationMethod);
  } else {
    return didVerify(message, signature, proof.type, verificationMethod, resolverOrDidDocument);
  }
}
