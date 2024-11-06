import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { StacksNetwork } from '@stacks/network';
import {
  ChainID,
  TransactionVersion,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  getPublicKey,
  publicKeyToString,
} from '@stacks/transactions';
import * as bip39 from 'bip39';
import { getBnsName, getConfirmedTransactions } from '../api';
import EsploraApiProvider from '../api/esplora/esploraAPiProvider';
import {
  BTC_SEGWIT_PATH_PURPOSE,
  BTC_TAPROOT_PATH_PURPOSE,
  BTC_WRAPPED_SEGWIT_PATH_PURPOSE,
  STX_PATH_WITHOUT_INDEX,
} from '../constant';
import { createWalletGaiaConfig, deriveWalletConfigKey, updateWalletConfig } from '../gaia';
import { SeedVault } from '../seedVault';
import { Account, BtcPaymentType, NetworkType, SettingsNetwork, StxTransactionListData } from '../types';
import { BIP32Interface, bip32 } from '../utils/bip32';
import { ECPair, ECPairInterface } from '../utils/ecpair';
import { GAIA_HUB_URL } from './../constant';

function getStxDerivationPath(chain: ChainID, index: bigint) {
  return `${STX_PATH_WITHOUT_INDEX}${index.toString()}`;
}

function ecPairToHexString(secretKey: ECPairInterface): string {
  if (!secretKey.privateKey) {
    throw new Error('Unexpected: secretKey without privateKey provided for hex conversion');
  }

  const ecPointHex = secretKey.privateKey.toString('hex');

  if (secretKey.compressed) {
    return ecPointHex + '01';
  } else {
    return ecPointHex;
  }
}

export function deriveStxAddressChain(chain: ChainID, index = 0n) {
  return (rootNode: BIP32Interface) => {
    const childKey = rootNode.derivePath(getStxDerivationPath(chain, index));
    if (!childKey.privateKey) {
      throw new Error('Unable to derive private key from `rootNode`, bip32 master keychain');
    }
    const ecPair = ECPair.fromPrivateKey(childKey.privateKey);
    const privateKey = ecPairToHexString(ecPair);
    const txVersion = chain === ChainID.Mainnet ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
    return {
      childKey,
      address: getAddressFromPrivateKey(privateKey, txVersion),
      privateKey,
    };
  };
}

export function getNestedSegwitDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint | number;
  network: NetworkType;
}) {
  const accountIndex = account ? account.toString() : '0';
  return network === 'Mainnet'
    ? `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export function getNativeSegwitDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint | number;
  network: NetworkType;
}) {
  const accountIndex = account ? account.toString() : '0';
  return network === 'Mainnet'
    ? `${BTC_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export function getTaprootDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint | number;
  network: NetworkType;
}) {
  const accountIndex = account ? account.toString() : '0';
  return network === 'Mainnet'
    ? `${BTC_TAPROOT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_TAPROOT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export async function getAccountFromRootNode({
  index,
  network,
  rootNode,
}: {
  index: bigint;
  network: NetworkType;
  rootNode: BIP32Interface;
}): Promise<Account> {
  // STX =================================================
  const deriveStxAddressKeychain = deriveStxAddressChain(
    network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet,
    index,
  );

  const { address, privateKey } = await deriveStxAddressKeychain(rootNode);
  const stxAddress = address;

  const stxPublicKey = publicKeyToString(getPublicKey(createStacksPrivateKey(privateKey)));

  // BTC =================================================
  const masterPubKey = rootNode.publicKey.toString('hex');
  const btcNetwork = network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK;

  // derive nested segwit btc address
  const nestedKeyPair = rootNode.derivePath(getNestedSegwitDerivationPath({ index, network }));
  const nestedP2wpkh = btc.p2wpkh(nestedKeyPair.publicKey, btcNetwork);
  const nestedP2 = btc.p2sh(nestedP2wpkh, btcNetwork);

  const nestedAddress = nestedP2.address!;
  const nestedPublicKey = hex.encode(nestedKeyPair.publicKey);

  // derive native segwit btc address
  const nativeKeyPair = rootNode.derivePath(getNativeSegwitDerivationPath({ index, network }));
  const nativeP2 = btc.p2wpkh(nativeKeyPair.publicKey, btcNetwork);

  const nativeAddress = nativeP2.address!;
  const nativePublicKey = hex.encode(nativeKeyPair.publicKey);

  // derive taproot btc address
  const taprootKeyPair = rootNode.derivePath(getTaprootDerivationPath({ index, network }));
  const xOnlyPubKey = taprootKeyPair.publicKey.subarray(1);
  const taprootP2 = btc.p2tr(xOnlyPubKey, undefined, btcNetwork);

  const taprootAddress = taprootP2.address!;
  const taprootPublicKey = hex.encode(taprootP2.tapInternalKey);

  return {
    id: Number(index),
    stxAddress,
    stxPublicKey,
    accountType: 'software',
    masterPubKey,
    btcAddresses: {
      nested: {
        address: nestedAddress,
        publicKey: nestedPublicKey,
      },
      native: {
        address: nativeAddress,
        publicKey: nativePublicKey,
      },
      taproot: {
        address: taprootAddress,
        publicKey: taprootPublicKey,
      },
    },
  };
}

export async function getAccountFromSeedPhrase({
  mnemonic,
  index,
  network,
}: {
  mnemonic: string;
  index: bigint;
  network: NetworkType;
}): Promise<Account> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(seed);

  return getAccountFromRootNode({
    index,
    network,
    rootNode,
  });
}

export async function getAccountFromSeedVault({
  seedVault,
  index,
  network,
}: {
  seedVault: SeedVault;
  index: bigint;
  network: NetworkType;
}): Promise<Account> {
  const mnemonic = await seedVault.getSeed();

  return getAccountFromSeedPhrase({
    index,
    network,
    mnemonic,
  });
}

export async function checkAccountActivity(
  account: Account,
  selectedNetwork: StacksNetwork,
  btcApi: EsploraApiProvider,
) {
  // We check addresses one at a time to minimise API calls avoiding rate limiting
  const addressHasActivity = async (addressToCheck: string | undefined) => {
    if (!addressToCheck) {
      return false;
    }
    const addressMetadata = await btcApi.getAddressData(addressToCheck);

    return addressMetadata.chain_stats.tx_count + addressMetadata.mempool_stats.tx_count > 0;
  };

  // check taproot first
  if (await addressHasActivity(account.btcAddresses.taproot?.address)) {
    return true;
  }

  // then check native
  if (await addressHasActivity(account.btcAddresses.native?.address)) {
    return true;
  }

  // then check nested
  if (await addressHasActivity(account.btcAddresses.nested?.address)) {
    return true;
  }

  // check stx last
  if (account.stxAddress) {
    const stxTxHistory: StxTransactionListData = await getConfirmedTransactions({
      stxAddress: account.stxAddress,
      network: selectedNetwork,
    });
    if (stxTxHistory.totalCount !== 0) return true;
  }

  return false;
}

export async function* restoreWalletWithAccounts(
  btcClient: EsploraApiProvider,
  mnemonic: string,
  btcNetwork: SettingsNetwork,
  stacksNetwork: StacksNetwork,
  currentAccounts: Account[],
  checkForNewAccountLimit = 0,
  generatorMode = false,
): AsyncGenerator<Account, Account[]> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(seed);

  const newAccounts: Account[] = [];
  let maxIdx = 0n;

  for (const existingAccount of currentAccounts) {
    maxIdx++;
    if (existingAccount.btcAddresses) {
      newAccounts.push(existingAccount);

      if (generatorMode) {
        yield existingAccount;
      }
      continue;
    }

    const newAccount = await getAccountFromRootNode({
      index: BigInt(existingAccount.id),
      network: btcNetwork.type,
      rootNode,
    });
    const username = await getBnsName(newAccount.stxAddress, stacksNetwork);
    newAccount.bnsName = username;
    newAccounts.push(newAccount);

    if (generatorMode) {
      yield newAccount;
    }
  }

  const emptyAccounts: Account[] = [];

  while (emptyAccounts.length < checkForNewAccountLimit) {
    const newAccount = await getAccountFromRootNode({
      index: maxIdx,
      network: btcNetwork.type,
      rootNode,
    });

    const username = await getBnsName(newAccount.stxAddress, stacksNetwork);
    newAccount.bnsName = username;

    const accountHasActivity = await checkAccountActivity(newAccount, stacksNetwork, btcClient);

    if (!accountHasActivity) {
      emptyAccounts.push(newAccount);
      continue;
    }

    while (emptyAccounts.length) {
      const emptyAccount = emptyAccounts.shift();

      if (emptyAccount) {
        newAccounts.push(emptyAccount);

        if (generatorMode) {
          yield emptyAccount;
        }
      }
    }

    newAccounts.push(newAccount);

    if (generatorMode) {
      yield newAccount;
    }

    maxIdx++;
  }

  return newAccounts;
}

export async function createWalletAccount(
  mnemonic: string,
  selectedNetwork: SettingsNetwork,
  networkObject: StacksNetwork,
  walletAccounts: Account[],
): Promise<Account[]> {
  const accountIndex = walletAccounts.length;
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(seed);

  const newAccount = await getAccountFromRootNode({
    index: BigInt(accountIndex),
    network: selectedNetwork.type,
    rootNode,
  });
  const username = await getBnsName(newAccount.stxAddress, networkObject);
  newAccount.bnsName = username;

  const updateAccountsList = [...walletAccounts, newAccount];

  try {
    const walletConfigKey = await deriveWalletConfigKey(rootNode);
    const gaiaHubConfig = await createWalletGaiaConfig({
      gaiaHubUrl: GAIA_HUB_URL,
      configPrivateKey: walletConfigKey,
    });
    await updateWalletConfig({
      walletAccounts: updateAccountsList,
      gaiaHubConfig,
      configPrivateKey: walletConfigKey,
    });
  } catch (err) {
    // noop
  }

  return updateAccountsList;
}

export const getAccountAddressDetails = (account: Account, btcPaymentAddressType: BtcPaymentType) => {
  const ordinalsAddress = account.btcAddresses.taproot.address;
  const ordinalsPublicKey = account.btcAddresses.taproot.publicKey;

  switch (btcPaymentAddressType) {
    case 'nested': {
      const address = account.btcAddresses.nested;
      if (!address) throw new Error('Nested Segwit address not found');
      return {
        btcAddress: address.address,
        btcPublicKey: address.publicKey,
        ordinalsAddress,
        ordinalsPublicKey,
      };
    }
    case 'native':
      const address = account.btcAddresses.native;
      if (!address) throw new Error('Native Segwit address not found');
      return {
        btcAddress: address.address,
        btcPublicKey: address.publicKey,
        ordinalsAddress,
        ordinalsPublicKey,
      };
    default:
      throw new Error('Unsupported payment address type');
  }
};
