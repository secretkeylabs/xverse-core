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
import { StacksApiProvider } from '../api';
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

const getBtcAddressBalanceAndHistory = async (btcClient: EsploraProvider, address: string | undefined) => {
  if (!address) return { balance: 0n, hasHistory: false };
  const addressData = await btcClient.getAddressData(address);
  return {
    balance: BigInt(addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum),
    hasHistory: addressData.chain_stats.tx_count + addressData.mempool_stats.tx_count > 0,
  };
};

const getStxAddressBalanceAndHistory = async (stxClient: StacksApiProvider, address: string) => {
  const balance = await stxClient.getAddressBalance(address);
  const hasHistory = balance.totalBalance.gt(0) || balance.nonce > 0;
  return { balance: BigInt(balance.totalBalance.toString()), hasHistory };
};

const getBalancesAtIndex = async (options: {
  btcClient: EsploraProvider;
  stxClient: StacksApiProvider;
  rootNode: bip32.HDKey;
  network: NetworkType;
  derivationType: DerivationType;
  derivationIndex: bigint;
}) => {
  const account = await getAccountFromRootNode({ ...options, walletId: 'dummy_wallet_id' as WalletId });

  const nativeAddress = account.btcAddresses.native!.address;
  const nestedAddress = account.btcAddresses.nested!.address;
  const taprootAddress = account.btcAddresses.taproot!.address;
  const stxAddress = account.stxAddress;

  const [native, nested, taproot, stx] = await Promise.all([
    getBtcAddressBalanceAndHistory(options.btcClient, nativeAddress),
    getBtcAddressBalanceAndHistory(options.btcClient, nestedAddress),
    getBtcAddressBalanceAndHistory(options.btcClient, taprootAddress),
    getStxAddressBalanceAndHistory(options.stxClient, stxAddress),
  ]);

  return {
    native: { ...native, address: nativeAddress },
    nested: { ...nested, address: nestedAddress },
    taproot: { ...taproot, address: taprootAddress },
    stx: {
      ...stx,
      address: stxAddress,
    },
  };
};

export async function getAccountBalanceSummary(options: {
  btcClient: EsploraProvider;
  stxClient: StacksApiProvider;
  rootNode: bip32.HDKey;
  network: NetworkType;
  limit: number;
  derivationType: DerivationType;
  maxConsecutiveEmptyAccounts?: number;
}) {
  const { btcClient, stxClient, rootNode, network, limit, derivationType, maxConsecutiveEmptyAccounts = 2 } = options;

  const summary: {
    accountCount: bigint;
    nestedTotalSats: bigint;
    nativeTotalSats: bigint;
    taprootTotalSats: bigint;
    stxTotal: bigint;
    hasMoreAccounts: boolean;
    accountDetails: {
      native: { address: string; balance: bigint; hasHistory: boolean };
      nested: { address: string; balance: bigint; hasHistory: boolean };
      taproot: { address: string; balance: bigint; hasHistory: boolean };
      stx: { address: string; balance: bigint; hasHistory: boolean };
    }[];
  } = {
    accountCount: 0n,
    nestedTotalSats: 0n,
    nativeTotalSats: 0n,
    taprootTotalSats: 0n,
    stxTotal: 0n,
    hasMoreAccounts: false,
    accountDetails: [],
  };

  let idx = 0n;
  let consecutiveEmptyAccounts = 0;

  while (idx < limit) {
    // we try get maxConsecutiveEmptyAccounts +1 at a time to speed up execution
    const balancePromises: ReturnType<typeof getBalancesAtIndex>[] = [];
    let accountsToRetrieve = maxConsecutiveEmptyAccounts - consecutiveEmptyAccounts + 1;
    if (idx + BigInt(accountsToRetrieve) > limit) {
      accountsToRetrieve = limit - Number(idx);
    }

    for (let i = 0; i < accountsToRetrieve; i++) {
      balancePromises.push(
        getBalancesAtIndex({
          btcClient,
          stxClient,
          rootNode,
          network,
          derivationType,
          derivationIndex: idx + BigInt(i),
        }),
      );
    }

    const accountBalances = await Promise.all(balancePromises);

    for (const balances of accountBalances) {
      summary.nativeTotalSats += balances.native.balance;
      summary.nestedTotalSats += balances.nested.balance;
      summary.taprootTotalSats += balances.taproot.balance;
      summary.stxTotal += balances.stx.balance;
      summary.accountDetails.push(balances);

      if (
        balances.native.hasHistory ||
        balances.nested.hasHistory ||
        balances.taproot.hasHistory ||
        balances.stx.hasHistory
      ) {
        summary.accountCount = idx + 1n;
        consecutiveEmptyAccounts = 0;
      } else {
        consecutiveEmptyAccounts += 1;
      }

      idx += 1n;
    }

    if (consecutiveEmptyAccounts > maxConsecutiveEmptyAccounts) {
      break;
    }
  }

  if (summary.accountCount >= limit) {
    const outerBalances = await getBalancesAtIndex({
      btcClient,
      stxClient,
      rootNode,
      network,
      derivationType,
      derivationIndex: idx,
    });
    summary.hasMoreAccounts =
      outerBalances.native.hasHistory ||
      outerBalances.nested.hasHistory ||
      outerBalances.taproot.hasHistory ||
      outerBalances.stx.hasHistory;
  } else {
    // we may have added empty accounts, so we remove them
    summary.accountDetails = summary.accountDetails.slice(0, Number(summary.accountCount));
  }

  return summary;
}
