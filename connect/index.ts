import { createSha2Hash } from '@stacks/encryption';
import { deriveRootKeychainFromMnemonic, deriveStxAddressChain } from '@stacks/keychain';
import { ChainID } from '@stacks/transactions';
import { makeAuthResponse } from '@stacks/wallet-sdk';

export async function createAuthResponse(
  seedPhrase: string,
  accountIndex: number,
  authRequest: any
): Promise<string | undefined> {
  const rootNode = await deriveRootKeychainFromMnemonic(seedPhrase);
  const chainID = ChainID.Mainnet;
  const deriveStxAddressKeychain = deriveStxAddressChain(chainID);
  const { privateKey } = deriveStxAddressKeychain(rootNode);

  const gaiaUrl = 'https://hub.blockstack.org';

  const identitiesKeychain = rootNode.derivePath(`m/888'/0'`);
  const publicKeyHex = Buffer.from(identitiesKeychain.publicKey.toString('hex'));

  const sha2Hash = await createSha2Hash();

  const saltData = await sha2Hash.digest(publicKeyHex, 'sha256');
  const salt = saltData.toString('hex');

  const identityKeychain = identitiesKeychain.deriveHardened(0);
  const dataPrivateKey = identityKeychain.privateKey?.toString('hex');
  const appsKey = identityKeychain.deriveHardened(0).toBase58();

  const appURL = new URL(authRequest?.payload?.redirect_uri);

  if (dataPrivateKey) {
    return makeAuthResponse({
      gaiaHubUrl: gaiaUrl,
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