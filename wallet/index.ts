import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import * as btc from '@scure/btc-signer';
import { hashMessage } from '@stacks/encryption';
import { AddressVersion } from '@stacks/transactions';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import { c32addressDecode } from 'c32check';
import crypto from 'crypto';
import { getAccountFromRootNode } from '../account';
import EsploraProvider from '../api/esplora/esploraAPiProvider';
import { ENTROPY_BYTES } from '../constant';
import { getBtcNetworkDefinition } from '../transactions/btcNetwork';
import { type NetworkType } from '../types';
import { DerivationType, WalletId } from '../vaults';

export { hashMessage };

export function generateMnemonic(): string {
  const entropy = crypto.randomBytes(ENTROPY_BYTES);
  const mnemonic = bip39.entropyToMnemonic(entropy, wordlist);
  return mnemonic;
}

export async function mnemonicToRootNode(mnemonic: string): Promise<bip32.HDKey> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  return bip32.HDKey.fromMasterSeed(seed);
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
  try {
    return btc.Address(getBtcNetworkDefinition(network)).decode(btcAddress).type !== 'unknown';
  } catch (error) {
    return false;
  }
}

export function validateBtcAddressIsTaproot(btcAddress: string): boolean {
  try {
    // TODO: switch to btc.Address.decode with a new core major version
    return getAddressInfo(btcAddress)?.type === AddressType.p2tr;
  } catch {
    return false;
  }
}

const getAddressBalanceAndHistory = async (btcClient: EsploraProvider, address: string | undefined) => {
  if (!address) return { balance: 0n, hasHistory: false };
  const addressData = await btcClient.getAddressData(address);
  return {
    balance: BigInt(addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum),
    hasHistory: addressData.chain_stats.tx_count + addressData.mempool_stats.tx_count > 0,
  };
};

const getBalancesAtIndex = async (options: {
  btcClient: EsploraProvider;
  rootNode: bip32.HDKey;
  walletId: WalletId;
  network: NetworkType;
  derivationType: DerivationType;
  derivationIndex: bigint;
}) => {
  const account = await getAccountFromRootNode(options);

  const [native, nested] = await Promise.all([
    getAddressBalanceAndHistory(options.btcClient, account.btcAddresses.native?.address),
    getAddressBalanceAndHistory(options.btcClient, account.btcAddresses.nested?.address),
  ]);

  return { native, nested };
};

export async function getPaymentAccountSummary(options: {
  btcClient: EsploraProvider;
  rootNode: bip32.HDKey;
  walletId: WalletId;
  network: NetworkType;
  limit: number;
  derivationType: DerivationType;
}) {
  const { btcClient, rootNode, walletId, network, limit, derivationType } = options;

  const summary = {
    accountCount: 0n,
    nestedTotalSats: 0n,
    nativeTotalSats: 0n,
    hasMoreAccounts: false,
  };

  let idx = 0n;
  let consecutiveEmptyAccounts = 0n;

  while (idx < limit) {
    const balances = await getBalancesAtIndex({
      btcClient,
      rootNode,
      walletId,
      network,
      derivationType,
      derivationIndex: idx,
    });
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
    const outerBalances = await getBalancesAtIndex({
      btcClient,
      rootNode,
      walletId,
      network,
      derivationType,
      derivationIndex: idx,
    });
    summary.hasMoreAccounts = outerBalances.native.hasHistory || outerBalances.nested.hasHistory;
  }

  return summary;
}
