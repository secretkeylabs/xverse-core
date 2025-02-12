import { AppClient, DefaultWalletPolicy } from 'ledger-bitcoin';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../constant';
import { NetworkType } from '../types';
import { getCoinType, getPublicKeyFromXpubAtIndex } from './helper';
import { LedgerTransport } from './types';

/**
 * This function is used to get the native segwit account data from the ledger
 * @param transport - the transport object with connected ledger device
 * @param accountIndex - the account index of the account to import
 * @param addressIndex - the index of the account address to import
 * @param network - the network type (Mainnet or Testnet)
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importNativeSegwitAccountFromLedger({
  transport,
  network,
  accountIndex = 0,
  addressIndex = 0,
  showAddress = false,
}: {
  transport: LedgerTransport;
  network: NetworkType;
  accountIndex?: number;
  addressIndex?: number;
  showAddress?: boolean;
}): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = getCoinType(network);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`,
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to get the taproot account data from the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param accountIndex - the account index of the account to import
 * @param addressIndex - the index of the account address to import
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importTaprootAccountFromLedger({
  transport,
  network,
  accountIndex = 0,
  addressIndex = 0,
  showAddress = false,
}: {
  transport: LedgerTransport;
  network: NetworkType;
  accountIndex?: number;
  addressIndex?: number;
  showAddress?: boolean;
}): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = getCoinType(network);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`,
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex);

  return { address, publicKey: publicKey.toString('hex') };
}
