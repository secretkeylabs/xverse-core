import { hex } from '@scure/base';
import * as bip32 from '@scure/bip32';
import { createSha2Hash } from '@stacks/encryption';
import { makeAuthResponse } from '@stacks/wallet-sdk';
import { getStxAddressKeyChain } from '../account';
import { GAIA_HUB_URL } from '../constant';
import { StacksMainnet } from '../types';
import { DerivationType } from '../vaults';

export type AuthRequest = {
  payload: {
    redirect_uri: string;
    public_keys: string[];
    scopes?: string[];
    appDetails?: {
      icon?: string;
      name?: string;
    };
  };
};

export async function createAuthResponse(
  rootNode: bip32.HDKey,
  derivationType: DerivationType,
  accountIndex: number,
  authRequest: AuthRequest,
  additionalData?: Record<string, any>,
): Promise<string | undefined> {
  const { privateKey } = getStxAddressKeyChain(StacksMainnet, rootNode, derivationType, BigInt(accountIndex));

  const identitiesKeychain = rootNode.derive(`m/888'/0'`);

  const sha2Hash = await createSha2Hash();

  const saltData = await sha2Hash.digest(identitiesKeychain.publicKey!, 'sha256');
  const salt = saltData.toString();

  const identityKeychain = identitiesKeychain.deriveChild(bip32.HARDENED_OFFSET + 0);
  const dataPrivateKey = identityKeychain.privateKey;
  const appsKey = identityKeychain.deriveChild(bip32.HARDENED_OFFSET + 0).privateExtendedKey;

  if (!dataPrivateKey) {
    return;
  }

  const appURL = new URL(authRequest.payload.redirect_uri);

  return makeAuthResponse({
    gaiaHubUrl: GAIA_HUB_URL,
    appDomain: appURL.origin,
    transitPublicKey: authRequest.payload.public_keys[0],
    scopes: authRequest.payload.scopes,
    account: {
      stxPrivateKey: privateKey,
      index: accountIndex,
      salt,
      dataPrivateKey: hex.encode(dataPrivateKey),
      appsKey,
    },
    additionalData,
  });
}
