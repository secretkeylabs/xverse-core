import {
  Account,
  CairoCustomEnum,
  CairoOption,
  CairoOptionVariant,
  CallData,
  constants,
  ec,
  encode,
  hash,
  num,
  RpcProvider,
  type Calldata,
} from 'starknet';
import { argentXContractClassHashV0_4_0, starknetCoinType, networkNameToApi } from './constants';
import { safePromise } from '../utils';
import { grindKey } from '@scure/starknet';
import BigNumber from 'bignumber.js';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { hex as scureHex } from '@scure/base';

export function sanitizeFelt252(hex: string): string {
  if (BigInt(hex) >= constants.PRIME - BigInt(1)) {
    throw new Error("Hex string doesn't fit in felt252.");
  }

  const noPrefix = encode.removeHexPrefix(hex);
  if (noPrefix.length > 64) throw new Error('Felt hex string too long.');

  return encode.sanitizeHex(encode.padLeft(noPrefix, 64));
}

interface GetAccountDerivationPathArgs {
  /**
   * The BIP44 hardened account index $i$ in $i_H$.
   */
  accountIndex: bigint;
}

export function getAccountDerivationPath({ accountIndex }: GetAccountDerivationPathArgs): string {
  return `m/44'/${starknetCoinType}/${accountIndex}'/0/0`;
}

const getAccountPrivateKeyArgsType = {
  seed: 'seed',
  extendedPrivateKey: 'extended-private-key',
  mnemonic: 'mnemonic',
  rootNode: 'root-node',
} as const;

export type GetAccountPrivateKeyArgsType =
  (typeof getAccountPrivateKeyArgsType)[keyof typeof getAccountPrivateKeyArgsType];

export interface GetAccountPrivateKeyArgsBaseType<T extends GetAccountPrivateKeyArgsType> {
  type: T;
}

interface GetAccountPrivateKeyArgsBaseArgs extends GetAccountDerivationPathArgs {
  network: constants.NetworkName;
}

interface Seed
  extends GetAccountPrivateKeyArgsBaseType<typeof getAccountPrivateKeyArgsType.seed>,
    GetAccountPrivateKeyArgsBaseArgs {
  seed: Uint8Array;
}

interface MasterExtendedPrivateKey
  extends GetAccountPrivateKeyArgsBaseType<typeof getAccountPrivateKeyArgsType.extendedPrivateKey>,
    GetAccountPrivateKeyArgsBaseArgs {
  extendedPrivateKey: string;
}

interface Mnemonic
  extends GetAccountPrivateKeyArgsBaseType<typeof getAccountPrivateKeyArgsType.mnemonic>,
    GetAccountPrivateKeyArgsBaseArgs {
  mnemonic: string;
}

interface RootNode
  extends GetAccountPrivateKeyArgsBaseType<typeof getAccountPrivateKeyArgsType.rootNode>,
    GetAccountPrivateKeyArgsBaseArgs {
  rootNode: bip32.HDKey;
}

export type GetAccountPrivateKeyArgs = Seed | MasterExtendedPrivateKey | Mnemonic | RootNode;

export async function getAccountPrivateKey(data: GetAccountPrivateKeyArgs): Promise<Uint8Array> {
  const rootNode = await (async () => {
    switch (data.type) {
      case getAccountPrivateKeyArgsType.rootNode: {
        return data.rootNode;
      }

      case getAccountPrivateKeyArgsType.seed: {
        return bip32.HDKey.fromMasterSeed(data.seed);
      }

      case getAccountPrivateKeyArgsType.extendedPrivateKey: {
        return bip32.HDKey.fromExtendedKey(data.extendedPrivateKey);
      }

      case getAccountPrivateKeyArgsType.mnemonic: {
        return bip32.HDKey.fromMasterSeed(await bip39.mnemonicToSeed(data.mnemonic));
      }

      default: {
        throw new Error('Invalid private key type', { cause: data satisfies never });
      }
    }
  })();

  const accountNode = rootNode.derive(getAccountDerivationPath({ accountIndex: data.accountIndex }));

  const privateKey = accountNode.privateKey;

  if (!privateKey) throw new Error('Failed to generate Starknet account private key.');

  // Starknet uses smaller keys that need to fit in 252 bits. The `grindKey()`
  // function is used to deterministically produce a key that fits into 252 bits
  // from the 256-bit key.
  //
  // - https://docs.starknet.io/architecture-and-concepts/cryptography/
  const groundPrivateKey = grindKey(privateKey);

  return num.hexToBytes(encode.sanitizeHex(groundPrivateKey));
}

export function getPublicKey(privateKey: Uint8Array): Uint8Array {
  // Using `hexToBytes()` helper since
  // [`fromHex()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromHex)
  // isn't currently supported in Chrome.
  return num.hexToBytes(ec.starkCurve.getStarkKey(privateKey));
}

/**
 * In the starknet.js ecosystem, hex-encoded strings are mostly expected to have
 * a `0x` prefix, and will cause errors when not present. This function ensures
 * hex-encoded strings have the prefix.
 *
 * There's an issue open to allow for more flexible hex-encoded strings,
 *
 * - https://github.com/starknet-io/starknet.js/issues/1307
 */
export function starknetHexString(hex: string): string {
  return encode.sanitizeHex(hex);
}

export const contractType = {
  AX040W0G: 'argent-x-v0_4_0-with-0-guardians',
} as const;

export type AccountContractTemplateName = (typeof contractType)[keyof typeof contractType];

export type ContractDescription = {
  template: AccountContractTemplateName;
  classHash: string;
  constructorCalldata: Calldata;
};

export function createAX040W0GContractDescription({ publicKey }: { publicKey: Uint8Array }): ContractDescription {
  return {
    template: contractType.AX040W0G,
    classHash: argentXContractClassHashV0_4_0,
    constructorCalldata: CallData.compile({
      owner: new CairoCustomEnum({
        Starknet: { signer: encode.sanitizeHex(encode.buf2hex(publicKey)) },
        Secp256k1: undefined,
        Secp256r1: undefined,
        Eip191: undefined,
        Webauthn: undefined,
      }),
      guardian: new CairoOption(CairoOptionVariant.None),
    }),
  };
}

// NOTE: This map, the creators, and the contract types are all collectively
// based on the assumption that the wallet will initialize a preset set of
// contracts, and does not support dynamic contract initialization. Supporting
// dynamic contract initialization (i.e., using arbitrary constructor args
// determined by the Xverse wallet) requires more work to support which is
// outside of the scope of the exploratory / MVP context with which Starkent
// support is being added to the wallet.
export const accountContractTemplateCreators = {
  [contractType.AX040W0G]: createAX040W0GContractDescription,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<AccountContractTemplateName, (...args: any[]) => ContractDescription>;

type GetExpectedAccountContractAddress = {
  publicKey: Uint8Array;
  contractDescription: ContractDescription;
};
export function getExpectedAccountContractAddress({
  publicKey,
  contractDescription,
}: GetExpectedAccountContractAddress) {
  // Using `encode()` helper since
  // [`toHex()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toHex)
  // isn't currently supported in Chrome.
  return sanitizeFelt252(
    hash.calculateContractAddressFromHash(
      starknetHexString(scureHex.encode(publicKey)),
      contractDescription.classHash,
      contractDescription.constructorCalldata,
      0, // QUESTION: What is this number?
    ),
  );
}

type DeployAccountArgs = {
  privateKey: Uint8Array;
  contractDescription: ContractDescription;

  /**
   * Network on which to deploy the account contract. Defaults to Mainnet.
   */
  network?: constants.NetworkName;
};
export async function deployAccount({ privateKey, contractDescription, network }: DeployAccountArgs) {
  const resolvedNetwork = network ?? constants.NetworkName.SN_MAIN;

  const providerClient = new RpcProvider({
    nodeUrl: networkNameToApi[resolvedNetwork],
  });
  const publicKey = getPublicKey(privateKey);

  const expectedAccountContractAddress = getExpectedAccountContractAddress({
    publicKey,
    contractDescription,
  });

  const accountClient = new Account(
    providerClient,
    expectedAccountContractAddress,
    privateKey,
    '1',
    constants.TRANSACTION_VERSION.V3,
  );

  const { contract_address: contractAddress, transaction_hash: transactionHash } = await accountClient.deployAccount({
    classHash: contractDescription.classHash,
    constructorCalldata: contractDescription.constructorCalldata,
    contractAddress: expectedAccountContractAddress,
    addressSalt: encode.sanitizeHex(encode.buf2hex(publicKey)),
  });

  return { contractAddress, transactionHash };
}

export function friToStrkFormatted(fri: bigint): string {
  const friBN = new BigNumber(fri.toString());
  const strkBN = friBN.dividedBy(1e18);
  return strkBN.toString();
}

export type CheckIsDeployedArgs = {
  address: string;
  network: constants.NetworkName;
};

export type CheckIsDeployedReturn =
  | {
      isDeployed: true;
      address: string;
      classHash: string;
    }
  | {
      isDeployed: false;
      address: string;
    };

export async function checkIsDeployed(arg: Account | CheckIsDeployedArgs): Promise<CheckIsDeployedReturn> {
  const address = arg.address;

  let classHashPromise: Promise<string>;
  if (arg instanceof Account) {
    classHashPromise = arg.getClassHashAt(address);
  } else {
    const provider = new RpcProvider({
      nodeUrl: networkNameToApi[arg.network],
    });
    classHashPromise = provider.getClassHashAt(address);
  }

  const [error, classHash] = await safePromise(classHashPromise);

  if (error) return { isDeployed: false, address };

  return { isDeployed: true, address, classHash };
}

export async function sendTx(target: string, entrypoint: string, calldata: string[], privateKey: Uint8Array) {
  const publicKey = getPublicKey(privateKey);
  const contractDescription = createAX040W0GContractDescription({ publicKey });
  const address = getExpectedAccountContractAddress({ publicKey, contractDescription });
  const account = new Account(
    {
      // 'https://api-3.xverse.app/starknet/v1/rpc' needs starknet_specVersion
      nodeUrl: 'https://free-rpc.nethermind.io/mainnet-juno/v0_8',
    },
    address,
    privateKey,
    '1',
    '0x3',
  );

  let justDeployed = false;

  if (!(await checkIsDeployed(account)).isDeployed) {
    await account.deployAccount({
      classHash: contractDescription.classHash,
      constructorCalldata: contractDescription.constructorCalldata,
      contractAddress: address,
      addressSalt: encode.sanitizeHex(encode.buf2hex(publicKey)),
    });
    justDeployed = true;
  }

  const { transaction_hash: transactionHash } = await account.execute(
    [{ contractAddress: target, calldata: calldata, entrypoint }],
    { nonce: justDeployed ? 0 : await account.getNonce() },
  );

  return transactionHash;
}

/**
 *
 * @param token address of the token contract
 * @param privateKey
 * @param amount in lowest unitary denomination of the given token
 * @param recipient
 */
export const dispatchTransfer = (token: string, privateKey: Uint8Array, amount: bigint, recipient: string) => {
  const amountArg = amount.toString();
  return sendTx(token, 'transfer', [recipient, amountArg, '0'], privateKey);
};

export function truncateAddress(address: string): string {
  if (address.length <= 14) return address;

  const start = address.slice(0, 8);
  const end = address.slice(-6);

  return `${start}...${end}`;
}
