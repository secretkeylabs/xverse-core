import { hex } from '@scure/base';
import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { getAddressFromPrivateKey, privateKeyToPublic, publicKeyToHex } from '@stacks/transactions';
import { getBnsName, getConfirmedTransactions } from '../api';
import EsploraApiProvider from '../api/esplora/esploraAPiProvider';
import {
  BTC_SEGWIT_PATH_PURPOSE,
  BTC_TAPROOT_PATH_PURPOSE,
  BTC_WRAPPED_SEGWIT_PATH_PURPOSE,
  STX_PATH_PURPOSE,
} from '../constant';
import { createWalletGaiaConfig, deriveWalletConfigKey, updateWalletConfig } from '../gaia';
import { getBtcNetworkDefinition } from '../transactions/btcNetwork';
import {
  Account,
  BtcPaymentType,
  NetworkType,
  SettingsNetwork,
  StacksMainnet,
  StacksNetwork,
  StacksTestnet,
  StxTransactionListData,
} from '../types';
import { ECPair, ECPairInterface } from '../utils/ecpair';
import { DerivationType, WalletId } from '../vaults';
import { GAIA_HUB_URL } from './../constant';

function getStxDerivationPath(derivationType: DerivationType, index: bigint) {
  let accountIndex = 0n;
  let addressIndex = 0n;

  if (derivationType === 'index') {
    addressIndex = index;
  } else {
    accountIndex = index;
  }
  return `${STX_PATH_PURPOSE}${accountIndex}'/0/${addressIndex}`;
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

export function getStxAddressKeyChain(
  network: StacksNetwork,
  rootNode: HDKey,
  derivationType: DerivationType,
  index: bigint,
) {
  const childKey = rootNode.derive(getStxDerivationPath(derivationType, index));
  if (!childKey.privateKey) {
    throw new Error('Unable to derive private key from `rootNode`, bip32 master keychain');
  }
  const ecPair = ECPair.fromPrivateKey(Buffer.from(childKey.privateKey));
  const privateKey = ecPairToHexString(ecPair);
  return {
    childKey,
    address: getAddressFromPrivateKey(privateKey, network),
    privateKey,
  };
}

export function getNestedSegwitDerivationPath({
  accountIndex,
  index,
  network,
}: {
  accountIndex: bigint | number;
  index: bigint | number;
  network: NetworkType;
}) {
  return network === 'Mainnet'
    ? `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export function getNativeSegwitDerivationPath({
  accountIndex,
  index,
  network,
}: {
  accountIndex: bigint | number;
  index: bigint | number;
  network: NetworkType;
}) {
  return network === 'Mainnet'
    ? `${BTC_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export function getTaprootDerivationPath({
  accountIndex,
  index,
  network,
}: {
  accountIndex: bigint | number;
  index: bigint | number;
  network: NetworkType;
}) {
  return network === 'Mainnet'
    ? `${BTC_TAPROOT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_TAPROOT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export async function getAccountFromRootNode({
  derivationIndex,
  derivationType,
  network,
  rootNode,
  walletId,
}: {
  derivationIndex: bigint;
  derivationType: DerivationType;
  network: NetworkType;
  rootNode: HDKey;
  walletId: WalletId;
}): Promise<Account> {
  let accountIndex = 0n;
  let index = 0n;

  if (derivationType === 'account') {
    accountIndex = derivationIndex;
  } else {
    index = derivationIndex;
  }

  // STX =================================================
  const { address, privateKey } = getStxAddressKeyChain(
    network === 'Mainnet' ? StacksMainnet : StacksTestnet,
    rootNode,
    derivationType,
    derivationIndex,
  );
  const stxAddress = address;

  const stxPublicKey = publicKeyToHex(privateKeyToPublic(privateKey));

  if (!rootNode.privateKey || !rootNode.publicKey) {
    throw new Error('Root node does not have a private and public key');
  }

  // BTC =================================================
  const masterPubKey = hex.encode(rootNode.publicKey);
  const btcNetwork = getBtcNetworkDefinition(network);

  // derive nested segwit btc address
  const nestedKeyPair = rootNode.derive(getNestedSegwitDerivationPath({ accountIndex, index, network }));
  const nestedP2wpkh = btc.p2wpkh(nestedKeyPair.publicKey!, btcNetwork);
  const nestedP2 = btc.p2sh(nestedP2wpkh, btcNetwork);

  const nestedAddress = nestedP2.address!;
  const nestedPublicKey = hex.encode(nestedKeyPair.publicKey!);

  // derive native segwit btc address
  const nativeKeyPair = rootNode.derive(getNativeSegwitDerivationPath({ accountIndex, index, network }));
  const nativeP2 = btc.p2wpkh(nativeKeyPair.publicKey!, btcNetwork);

  const nativeAddress = nativeP2.address!;
  const nativePublicKey = hex.encode(nativeKeyPair.publicKey!);

  // derive taproot btc address
  const taprootKeyPair = rootNode.derive(getTaprootDerivationPath({ accountIndex, index, network }));
  const xOnlyPubKey = taprootKeyPair.publicKey!.subarray(1);
  const taprootP2 = btc.p2tr(xOnlyPubKey, undefined, btcNetwork);

  const taprootAddress = taprootP2.address!;
  const taprootPublicKey = hex.encode(taprootP2.tapInternalKey);

  const id = Math.max(Number(accountIndex), Number(index));

  return {
    id,
    stxAddress,
    stxPublicKey,
    accountType: 'software',
    masterPubKey,
    walletId,
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

export async function* restoreWalletWithAccounts(options: {
  btcClient: EsploraApiProvider;
  rootNode: HDKey;
  walletId: WalletId;
  derivationType: DerivationType;
  btcNetwork: SettingsNetwork;
  stacksNetwork: StacksNetwork;
  currentAccounts: Account[];
  minimumAccountsListLength?: number;
  checkForNewAccountLimit?: number;
  generatorMode?: boolean;
}): AsyncGenerator<Account, Account[]> {
  const {
    btcClient,
    walletId,
    rootNode,
    derivationType,
    btcNetwork,
    stacksNetwork,
    currentAccounts,
    minimumAccountsListLength = 0,
    checkForNewAccountLimit = 0,
    generatorMode = false,
  } = options;

  const newAccounts: Account[] = [];
  let genIndex = 0n;

  for (const existingAccount of currentAccounts) {
    if (BigInt(existingAccount.id) === genIndex && existingAccount.btcAddresses) {
      genIndex++;
      newAccounts.push(existingAccount);

      if (generatorMode) {
        yield existingAccount;
      }
      continue;
    }

    const newAccount = await getAccountFromRootNode({
      derivationIndex: BigInt(genIndex++),
      derivationType,
      network: btcNetwork.type,
      rootNode,
      walletId,
    });
    const username = await getBnsName(newAccount.stxAddress, stacksNetwork);
    newAccount.bnsName = username;
    newAccounts.push(newAccount);

    if (generatorMode) {
      yield newAccount;
    }
  }

  while (newAccounts.length < minimumAccountsListLength) {
    const newAccount = await getAccountFromRootNode({
      derivationIndex: BigInt(genIndex++),
      derivationType,
      network: btcNetwork.type,
      rootNode,
      walletId,
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
      derivationIndex: BigInt(genIndex++),
      derivationType,
      network: btcNetwork.type,
      rootNode,
      walletId,
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
  }

  return newAccounts;
}

export async function createWalletAccount(
  rootNode: HDKey,
  walletId: WalletId,
  selectedNetwork: SettingsNetwork,
  networkObject: StacksNetwork,
  walletAccounts: Account[],
  derivationType: DerivationType,
): Promise<Account[]> {
  const accountIndex = walletAccounts.length;

  const newAccount = await getAccountFromRootNode({
    derivationIndex: BigInt(accountIndex),
    derivationType,
    network: selectedNetwork.type,
    rootNode,
    walletId,
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
  const ordinalsXpub = account.btcAddresses.taproot.xpub;

  switch (btcPaymentAddressType) {
    case 'nested': {
      const address = account.btcAddresses.nested;
      if (!address) throw new Error('Nested Segwit address not found');
      return {
        btcAddress: address.address,
        btcPublicKey: address.publicKey,
        btcXpub: address.xpub,
        ordinalsAddress,
        ordinalsPublicKey,
        ordinalsXpub,
      };
    }
    case 'native':
      const address = account.btcAddresses.native;
      if (!address) throw new Error('Native Segwit address not found');
      return {
        btcAddress: address.address,
        btcPublicKey: address.publicKey,
        btcXpub: address.xpub,
        ordinalsAddress,
        ordinalsPublicKey,
        ordinalsXpub,
      };
    default:
      throw new Error('Unsupported payment address type');
  }
};
