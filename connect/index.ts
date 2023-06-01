import { createSha2Hash } from '@stacks/encryption';
import { ChainID } from '@stacks/transactions';
import { makeAuthResponse } from '@stacks/wallet-sdk';
import * as bip39 from 'bip39';
import { bip32 } from 'bitcoinjs-lib';
import { hashMessage } from '@stacks/encryption';
import { deriveStxAddressChain } from '../wallet/utils/stx';
import { GAIA_HUB_URL } from '../constant';


export async function createAuthResponse(
  seedPhrase: string,
  accountIndex: number,
  authRequest: any
): Promise<string | undefined> {
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const rootNode = bip32.fromSeed(Buffer.from(seed));
  const chainID = ChainID.Mainnet;
  const deriveStxAddressKeychain = deriveStxAddressChain(chainID, BigInt(accountIndex));

  const { privateKey } = deriveStxAddressKeychain(rootNode);

  const identitiesKeychain = rootNode.derivePath(`m/888'/0'`);
  const publicKeyHex = Buffer.from(identitiesKeychain.publicKey.toString('hex'));

  const sha2Hash = await createSha2Hash();

  const saltData = await sha2Hash.digest(publicKeyHex, 'sha256');
  const salt = saltData.toString();

  const identityKeychain = identitiesKeychain.deriveHardened(0);
  const dataPrivateKey = identityKeychain.privateKey?.toString('hex');
  const appsKey = identityKeychain.deriveHardened(0).toBase58();

  const appURL = new URL(authRequest?.payload?.redirect_uri);

  if (dataPrivateKey) {
    return makeAuthResponse({
      gaiaHubUrl: GAIA_HUB_URL,
      appDomain: appURL.origin,
      transitPublicKey: authRequest?.payload?.public_keys[0],
      scopes: authRequest?.payload?.scopes,
      account: {
        stxPrivateKey: privateKey,
        index: accountIndex,
        salt,
        dataPrivateKey,
        appsKey,
      },
    });
  }

  return;
}

export { hashMessage };