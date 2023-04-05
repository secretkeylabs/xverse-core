import { AppClient, DefaultWalletPolicy } from 'ledger-bitcoin';
import { NetworkType } from 'types/network';
import { getPublicKeyFromXpubAtIndex } from './helper';

/**
 * This function is used to get the nested segwit account data from the ledger
 * @param app - the ledger app client
 * @param network - the network type
 * @param masterFingerPrint - the master finger print
 * @param accountIndex - the account index
 * @param addressIndex - the address index
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importNestedSegwitAccountFromLedger(
  app: AppClient,
  network: NetworkType,
  masterFingerPrint: string,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const btcNetwork = network === 'Mainnet' ? 0 : 1;
  const extendedPublicKey = await app.getExtendedPubkey(`m/49'/${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'sh(wpkh(@0/**))',
    `[${masterFingerPrint}/49'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to get the taproot account data from the ledger
 * @param app - the ledger app client
 * @param network - the network type
 * @param masterFingerPrint - the master finger print
 * @param accountIndex - the account index
 * @param addressIndex - the address index
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importTaprootAccountFromLedger(
  app: AppClient,
  network: NetworkType,
  masterFingerPrint: string,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const btcNetwork = network === 'Mainnet' ? 0 : 1;
  const extendedPublicKey = await app.getExtendedPubkey(`m/86'/${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}
