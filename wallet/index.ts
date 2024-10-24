/* eslint-disable @typescript-eslint/no-use-before-define */
import { hashMessage } from '@stacks/encryption';
import { AddressVersion, ChainID } from '@stacks/transactions';
import * as bip39 from 'bip39';
import { AddressType, Network as btcAddressNetwork, getAddressInfo, validate } from 'bitcoin-address-validation';
import { c32addressDecode } from 'c32check';
import crypto from 'crypto';
import { deriveStxAddressChain, getAccountFromSeedPhrase } from '../account';
import EsploraProvider from '../api/esplora/esploraAPiProvider';
import { ENTROPY_BYTES } from '../constant';
import { Keychain, NetworkType } from '../types';
import { bip32 } from '../utils/bip32';

export * from './encryptionUtils';
export { hashMessage };

export function generateMnemonic(): string {
  const entropy = crypto.randomBytes(ENTROPY_BYTES);
  const mnemonic = bip39.entropyToMnemonic(entropy);

  return mnemonic;
}

export function validateStxAddress({ stxAddress, network }: { stxAddress: string; network: NetworkType }) {
  try {
    const result = c32addressDecode(stxAddress);
    if (result[0] && result[1]) {
      const addressVersion = result[0];
      if (network === 'Mainnet') {
        if (
          !(addressVersion === AddressVersion.MainnetSingleSig || addressVersion === AddressVersion.MainnetMultiSig)
        ) {
          return false;
        }
      } else {
        if (result[0] !== AddressVersion.TestnetSingleSig && result[0] !== AddressVersion.TestnetMultiSig) {
          return false;
        }
      }

      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

export function validateBtcAddress({ btcAddress, network }: { btcAddress: string; network: NetworkType }): boolean {
  const btcNetwork = network === 'Mainnet' ? btcAddressNetwork.mainnet : btcAddressNetwork.testnet;
  try {
    return validate(btcAddress, btcNetwork);
  } catch (error) {
    return false;
  }
}

export function validateBtcAddressIsTaproot(btcAddress: string): boolean {
  try {
    return getAddressInfo(btcAddress)?.type === AddressType.p2tr;
  } catch {
    return false;
  }
}

export async function getStxAddressKeyChain(
  mnemonic: string,
  chainID: ChainID,
  accountIndex: number,
): Promise<Keychain> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));
  const deriveStxAddressKeychain = deriveStxAddressChain(chainID, BigInt(accountIndex));
  return deriveStxAddressKeychain(rootNode);
}

const getAddressBalanceAndHistory = async (btcClient: EsploraProvider, address: string | undefined) => {
  if (!address) return { balance: 0n, hasHistory: false };
  const addressData = await btcClient.getAddressData(address);
  return {
    balance: BigInt(addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum),
    hasHistory: addressData.chain_stats.tx_count + addressData.mempool_stats.tx_count > 0,
  };
};

const getBalancesAtIndex = async (btcClient: EsploraProvider, mnemonic: string, network: NetworkType, idx: bigint) => {
  const account = await getAccountFromSeedPhrase({ mnemonic, index: idx, network });

  const [native, nested] = await Promise.all([
    getAddressBalanceAndHistory(btcClient, account.btcAddresses.native?.address),
    getAddressBalanceAndHistory(btcClient, account.btcAddresses.nested?.address),
  ]);

  return { native, nested };
};

export async function getPaymentAccountSummaryForSeedPhrase(
  btcClient: EsploraProvider,
  seedPhrase: string,
  network: NetworkType,
  limit: number,
) {
  const summary = {
    accountCount: 0n,
    nestedTotalSats: 0n,
    nativeTotalSats: 0n,
    hasMoreAccounts: false,
  };

  let idx = 0n;
  let consecutiveEmptyAccounts = 0n;

  while (idx < limit) {
    const balances = await getBalancesAtIndex(btcClient, seedPhrase, network, idx);
    summary.nativeTotalSats += balances.native.balance;
    summary.nestedTotalSats += balances.nested.balance;

    if (balances.native.hasHistory || balances.nested.hasHistory) {
      summary.accountCount = idx + 1n;
      consecutiveEmptyAccounts = 0n;
    } else {
      consecutiveEmptyAccounts += 1n;
    }

    if (consecutiveEmptyAccounts > 2) {
      break;
    }

    idx += 1n;
  }

  if (summary.accountCount >= limit) {
    const outerBalances = await getBalancesAtIndex(btcClient, seedPhrase, network, idx);
    summary.hasMoreAccounts = outerBalances.native.hasHistory || outerBalances.nested.hasHistory;
  }

  return summary;
}
