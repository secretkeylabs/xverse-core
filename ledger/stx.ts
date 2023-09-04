import { NetworkType } from '../types';
import { getStxPath, makeLedgerCompatibleUnsignedAuthResponsePayload, signStxJWTAuth } from './helper';
import { LedgerErrors, LedgerStxJWTAuthProfile, Transport } from './types';
import StacksApp, { ResponseSign } from '@zondax/ledger-stacks';
import { StacksTransaction, AddressVersion } from '@stacks/transactions';
import { addSignatureToStxTransaction } from './transaction';

/**
 * This function is used to get the stx account data from the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param accountIndex - the account index of the account to sign with
 * @param addressIndex - the index of the account address to sign with
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importStacksAccountFromLedger({
  transport,
  network,
  accountIndex = 0,
  addressIndex = 0,
  showAddress = false,
}: {
  transport: Transport;
  network: NetworkType;
  accountIndex?: number;
  addressIndex?: number;
  showAddress?: boolean;
}): Promise<{ address: string; publicKey: string }> {
  const appStacks = new StacksApp(transport);
  const path = getStxPath({ accountIndex, addressIndex });
  const version = network === 'Mainnet' ? AddressVersion.MainnetSingleSig : AddressVersion.TestnetSingleSig;
  const { address, publicKey } = showAddress
    ? await appStacks.showAddressAndPubKey(path, version)
    : await appStacks.getAddressAndPubKey(path, version);

  if (!publicKey) {
    throw new Error(LedgerErrors.NO_PUBLIC_KEY);
  }

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to sign a Stacks transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param transactionBuffer - the transaction to sign
 * @param addressIndex - the address index of the account to sign with
 * @returns the signed transaction ready to be broadcasted
 * */
export async function signLedgerStxTransaction({
  transport,
  transactionBuffer,
  addressIndex,
}: {
  transport: Transport;
  transactionBuffer: Buffer;
  addressIndex: number;
}): Promise<StacksTransaction> {
  const appStacks = new StacksApp(transport);
  const path = getStxPath({ accountIndex: 0, addressIndex });
  const resp = await appStacks.sign(path, transactionBuffer);
  const signedTx = addSignatureToStxTransaction(transactionBuffer, resp.signatureVRS);

  return signedTx; // TX ready to be broadcast
}

/**
 * This function is used to sign a Stacks message with the ledger
 * @param transport - the transport object with connected ledger device
 * @param message - the message to sign
 * @param accountIndex - the account index of the account to sign with
 * @param addressIndex - the address index of the account to sign with
 * @returns the signed message
 * */
export async function signStxMessage({
  transport,
  message,
  accountIndex = 0,
  addressIndex = 0,
}: {
  transport: Transport;
  message: string;
  accountIndex?: number;
  addressIndex?: number;
}): Promise<ResponseSign> {
  const appStacks = new StacksApp(transport);
  const path = getStxPath({ accountIndex, addressIndex });
  // As of now 2023-04-27, the ledger app does not support signing messages longer than 152 bytes
  const result = await appStacks.sign_msg(path, message);
  return result as ResponseSign;
}

/**
 * This function is used to sign a Stacks JWT authentication request with the ledger
 * @param transport - the transport object with connected ledger device
 * @param addressIndex - the address index of the account to sign with
 * @param profile - the profile object containing STX address for mainnet and testnet
 * @returns the signed JWT authentication request
 * */
export async function handleLedgerStxJWTAuth({
  transport,
  addressIndex,
  profile,
}: {
  transport: Transport;
  addressIndex: number;
  profile: LedgerStxJWTAuthProfile;
}): Promise<string> {
  const appStacks = new StacksApp(transport);
  const { publicKey } = await appStacks.getIdentityPubKey(`m/888'/0'/${addressIndex}'`);

  const inputToSign = await makeLedgerCompatibleUnsignedAuthResponsePayload(publicKey.toString('hex'), profile);
  return signStxJWTAuth(transport, addressIndex, inputToSign);
}
