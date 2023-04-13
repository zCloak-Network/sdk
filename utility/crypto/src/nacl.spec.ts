// Copyright 2021-2023 zcloak authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Keypair } from './types';

import { stringToU8a, u8aEq } from '@polkadot/util';

import { naclOpen, naclSeal } from './nacl';

const KEYPAIR1: Keypair = {
  secretKey: new Uint8Array([
    220, 15, 230, 226, 89, 22, 43, 42, 153, 91, 12, 66, 173, 13, 164, 155, 252, 164, 191, 0, 154, 128, 98, 193, 158,
    255, 131, 166, 204, 208, 118, 252
  ]),
  publicKey: new Uint8Array([
    10, 98, 81, 84, 96, 50, 233, 178, 244, 17, 4, 87, 23, 1, 155, 212, 23, 14, 56, 172, 4, 100, 108, 196, 122, 153, 46,
    146, 195, 45, 141, 34
  ])
};
const KEYPAIR2: Keypair = {
  secretKey: new Uint8Array([
    51, 141, 192, 0, 208, 56, 166, 161, 173, 131, 75, 229, 242, 156, 250, 57, 155, 28, 156, 21, 226, 52, 183, 184, 12,
    158, 119, 218, 113, 55, 63, 13
  ]),
  publicKey: new Uint8Array([
    108, 98, 205, 185, 48, 65, 141, 188, 46, 201, 5, 86, 37, 68, 255, 229, 12, 161, 150, 49, 135, 128, 145, 20, 85, 38,
    219, 66, 203, 103, 65, 73
  ])
};

const message = stringToU8a('abcd');

describe('nacl', (): void => {
  it('encrypt and decrypt', (): void => {
    const { nonce, sealed } = naclSeal(message, KEYPAIR1.secretKey, KEYPAIR2.publicKey);
    const decrypted = naclOpen(sealed, nonce, KEYPAIR1.publicKey, KEYPAIR2.secretKey);

    expect(decrypted && u8aEq(decrypted, message)).toEqual(true);
  });
});
