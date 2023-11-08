import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import * as bip39 from 'bip39';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import AppClient, { DefaultWalletPolicy } from 'ledger-bitcoin';

import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import { MAINNET_BROADCAST_URI, TESTNET_BROADCAST_URI } from '../../ledger/constants';
import SeedVault from '../../seedVault';
import type { AccountType, NetworkType, UTXO, UtxoOrdinalBundle } from '../../types';
import { bip32 } from '../../utils/bip32';

import axios from 'axios';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE, BTC_WRAPPED_SEGWIT_PATH_PURPOSE } from '../../constant';
import { CompilationOptions, SupportedAddressType, WalletContext } from './types';
import { areByteArraysEqual, getOutpointFromUtxo } from './utils';

export type LedgerTransport = ConstructorParameters<typeof AppClient>[0];

const esploraMainnetProvider = new EsploraProvider({
  network: 'Mainnet',
});

const esploraTestnetProvider = new EsploraProvider({
  network: 'Testnet',
});

const esploraApi = {
  Mainnet: esploraMainnetProvider,
  Testnet: esploraTestnetProvider,
};

export class ExtendedUtxo {
  private _network!: NetworkType;

  private _utxo!: UTXO;

  private _address!: string;

  private _outpoint!: string;

  private _hex!: string;

  private _utxoCache!: UtxoCache;

  constructor(network: NetworkType, utxo: UTXO, address: string, utxoCache: UtxoCache) {
    this._network = network;
    this._utxo = utxo;
    this._address = address;
    this._outpoint = getOutpointFromUtxo(utxo);
    this._utxoCache = utxoCache;
  }

  get outpoint(): string {
    return this._outpoint;
  }

  get utxo(): UTXO {
    return this._utxo;
  }

  get hex(): Promise<string> {
    if (this._hex) {
      return Promise.resolve(this._hex);
    }

    return new Promise(async (resolve, reject) => {
      try {
        const txDataApiUrl = `${this._network === 'Mainnet' ? MAINNET_BROADCAST_URI : TESTNET_BROADCAST_URI}/${
          this._utxo.txid
        }/hex`;
        const response = await axios.get(txDataApiUrl);
        this._hex = response.data;

        resolve(this._hex);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getBundleData(): Promise<UtxoOrdinalBundle | undefined> {
    const bundleData = await this._utxoCache.getUtxoByOutpoint(this._outpoint, this._address);

    return bundleData;
  }

  /** Returns undefined if UTXO has not yet been indexed */
  async isEmbellished(): Promise<boolean | undefined> {
    const bundleData = await this.getBundleData();

    const hasInscriptionsOrExoticSats = bundleData?.sat_ranges.some(
      (satRange) => satRange.inscriptions.length > 0 || satRange.satributes.length > 0,
    );

    return hasInscriptionsOrExoticSats;
  }
}

export abstract class AddressContext {
  protected _type!: SupportedAddressType;

  protected _address!: string;

  protected _publicKey!: string;

  protected _network!: NetworkType;

  private _utxos?: ExtendedUtxo[];

  protected _seedVault!: SeedVault;

  protected _utxoCache!: UtxoCache;

  protected _accountIndex!: bigint;

  constructor(
    type: SupportedAddressType,
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: bigint,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
  ) {
    this._type = type;
    this._address = address;
    this._publicKey = publicKey;
    this._network = network;
    this._seedVault = seedVault;
    this._utxoCache = utxoCache;
    this._accountIndex = accountIndex;
  }

  get type(): SupportedAddressType {
    return this._type;
  }

  get address(): string {
    return this._address;
  }

  async getUtxos(): Promise<ExtendedUtxo[]> {
    if (!this._utxos) {
      const utxos = await esploraApi[this._network].getUnspentUtxos(this._address);

      this._utxos = utxos.map((utxo) => new ExtendedUtxo(this._network, utxo, this._address, this._utxoCache));
    }

    return [...this._utxos];
  }

  async getUnindexedUtxos(): Promise<ExtendedUtxo[]> {
    const utxos = await this.getUtxos();

    const unindexedUtxos: ExtendedUtxo[] = [];

    for (const utxo of utxos) {
      const isEmbellished = await utxo.isEmbellished();
      if (isEmbellished === undefined) {
        unindexedUtxos.push(utxo);
      }
    }

    return unindexedUtxos;
  }

  async getCommonUtxos(): Promise<ExtendedUtxo[]> {
    const utxos = await this.getUtxos();

    const commonUtxos: ExtendedUtxo[] = [];

    for (const utxo of utxos) {
      const isEmbellished = await utxo.isEmbellished();
      if (!isEmbellished && isEmbellished !== undefined) {
        commonUtxos.push(utxo);
      }
    }

    return commonUtxos;
  }

  async getEmbellishedUtxos(): Promise<ExtendedUtxo[]> {
    const utxos = await this.getUtxos();

    const embellishedUtxos: ExtendedUtxo[] = [];

    for (const utxo of utxos) {
      const isEmbellished = await utxo.isEmbellished();
      if (isEmbellished) {
        embellishedUtxos.push(utxo);
      }
    }

    return embellishedUtxos;
  }

  async getUtxo(outpoint: string): Promise<ExtendedUtxo | undefined> {
    const utxos = await this.getUtxos();

    return utxos.find((utxo) => utxo.outpoint === outpoint);
  }

  protected async getPrivateKey(seedPhrase: string): Promise<string> {
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    const master = bip32.fromSeed(seed);

    const btcChild = master.derivePath(this.getDerivationPath());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return btcChild.privateKey!.toString('hex');
  }

  protected abstract getDerivationPath(): string;
  abstract addInput(transaction: btc.Transaction, utxo: ExtendedUtxo, options?: CompilationOptions): Promise<void>;
  abstract signInputs(transaction: btc.Transaction): Promise<void>;
}

export class P2shAddressContext extends AddressContext {
  private _p2sh!: ReturnType<typeof btc.p2sh>;

  constructor(
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: bigint,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
  ) {
    super('p2sh', address, publicKey, network, accountIndex, seedVault, utxoCache);

    const publicKeyBuff = hex.decode(publicKey);

    const p2wpkh = btc.p2wpkh(publicKeyBuff, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);

    this._p2sh = btc.p2sh(p2wpkh, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }

  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const utxo = extendedUtxo.utxo;

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2sh.script,
        amount: BigInt(utxo.value),
      },
      redeemScript: this._p2sh.redeemScript,
      witnessScript: this._p2sh.witnessScript,
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
    });
  }

  async signInputs(transaction: btc.Transaction): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2sh.script)) {
        transaction.signIdx(hex.decode(privateKey), i);
      }
    }
  }

  protected getDerivationPath(): string {
    return this._network === 'Mainnet'
      ? `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}0'/0'/0/${this._accountIndex}`
      : `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}1'/0'/0/${this._accountIndex}`;
  }
}

export class P2wpkhAddressContext extends AddressContext {
  protected _p2wpkh!: ReturnType<typeof btc.p2wpkh>;

  constructor(
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: bigint,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
  ) {
    super('p2wpkh', address, publicKey, network, accountIndex, seedVault, utxoCache);

    const publicKeyBuff = hex.decode(publicKey);

    this._p2wpkh = btc.p2wpkh(publicKeyBuff, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }

  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const utxo = extendedUtxo.utxo;

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2wpkh.script,
        amount: BigInt(utxo.value),
      },
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
    });
  }

  async signInputs(transaction: btc.Transaction): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2wpkh.script)) {
        transaction.signIdx(hex.decode(privateKey), i);
      }
    }
  }

  protected getDerivationPath(): string {
    return this._network === 'Mainnet'
      ? `${BTC_SEGWIT_PATH_PURPOSE}0'/0'/0/${this._accountIndex}`
      : `${BTC_SEGWIT_PATH_PURPOSE}1'/0'/0/${this._accountIndex}`;
  }
}

class LedgerP2wpkhAddressContext extends P2wpkhAddressContext {
  private _transport!: LedgerTransport;

  constructor(
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: bigint,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    transport: LedgerTransport,
  ) {
    super(address, publicKey, network, accountIndex, seedVault, utxoCache);
    this._transport = transport;
  }

  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const app = new AppClient(this._transport);
    const masterFingerPrint = await app.getMasterFingerprint();

    const utxo = extendedUtxo.utxo;
    const nonWitnessUtxo = Buffer.from(await extendedUtxo.hex, 'hex');

    const inputDerivation = [
      Buffer.from(this._publicKey, 'hex'),
      {
        path: btc.bip32Path(this.getDerivationPath()),
        fingerprint: parseInt(masterFingerPrint, 16),
      },
    ] as [Uint8Array, { path: number[]; fingerprint: number }];

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2wpkh.script,
        amount: BigInt(utxo.value),
      },
      nonWitnessUtxo,
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
      bip32Derivation: [inputDerivation],
    });
  }

  async signInputs(transaction: btc.Transaction): Promise<void> {
    let hasInputsToSign = false;
    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2wpkh.script)) {
        hasInputsToSign = true;
        break;
      }
    }

    if (!hasInputsToSign) {
      return;
    }

    const app = new AppClient(this._transport);
    const masterFingerPrint = await app.getMasterFingerprint();
    const coinType = this._network === 'Mainnet' ? 0 : 1;
    const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'`);

    const accountPolicy = new DefaultWalletPolicy(
      'wpkh(@0/**)',
      `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
    );

    const psbt = transaction.toPSBT(0);
    const psbtBase64 = base64.encode(psbt);
    const signatures = await app.signPsbt(psbtBase64, accountPolicy, null);

    for (const signature of signatures) {
      transaction.updateInput(signature[0], {
        partialSig: [[signature[1].pubkey, signature[1].signature]],
      });
    }
  }
}

export class P2trAddressContext extends AddressContext {
  protected _p2tr!: ReturnType<typeof btc.p2tr>;

  constructor(
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: bigint,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
  ) {
    super('p2tr', address, publicKey, network, accountIndex, seedVault, utxoCache);
    const publicKeyBuff = hex.decode(publicKey);

    try {
      this._p2tr = btc.p2tr(publicKeyBuff, undefined, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
    } catch (err) {
      if (err instanceof Error && err.message.includes('schnorr')) {
        this._p2tr = btc.p2tr(
          publicKeyBuff.slice(1),
          undefined,
          network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK,
        );
      } else {
        throw err;
      }
    }
  }

  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const utxo = extendedUtxo.utxo;

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2tr.script,
        amount: BigInt(utxo.value),
      },
      tapInternalKey: hex.decode(this._publicKey),
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
    });
  }

  async signInputs(transaction: btc.Transaction): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2tr.script)) {
        transaction.signIdx(hex.decode(privateKey), i);
      }
    }
  }

  protected getDerivationPath(): string {
    return this._network === 'Mainnet'
      ? `${BTC_TAPROOT_PATH_PURPOSE}0'/0'/0/${this._accountIndex}`
      : `${BTC_TAPROOT_PATH_PURPOSE}1'/0'/0/${this._accountIndex}`;
  }
}

export class LedgerP2trAddressContext extends P2trAddressContext {
  private _transport!: LedgerTransport;

  constructor(
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: bigint,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    transport: LedgerTransport,
  ) {
    super(address, publicKey, network, accountIndex, seedVault, utxoCache);
    this._transport = transport;
  }

  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const app = new AppClient(this._transport);
    const masterFingerPrint = await app.getMasterFingerprint();

    const utxo = extendedUtxo.utxo;
    const nonWitnessUtxo = Buffer.from(await extendedUtxo.hex, 'hex');

    const inputDerivation = [
      hex.decode(this._publicKey),
      {
        path: btc.bip32Path(this.getDerivationPath()),
        fingerprint: parseInt(masterFingerPrint, 16),
      },
    ] as [Uint8Array, { path: number[]; fingerprint: number }];

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2tr.script,
        amount: BigInt(utxo.value),
      },
      nonWitnessUtxo,
      tapInternalKey: this._p2tr.tapInternalKey,
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
      bip32Derivation: [inputDerivation],
    });
  }

  async signInputs(transaction: btc.Transaction): Promise<void> {
    let hasInputsToSign = false;
    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2tr.script)) {
        hasInputsToSign = true;
        break;
      }
    }

    if (!hasInputsToSign) {
      return;
    }

    const app = new AppClient(this._transport);
    const masterFingerPrint = await app.getMasterFingerprint();
    const coinType = this._network === 'Mainnet' ? 0 : 1;
    const extendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'`);

    const accountPolicy = new DefaultWalletPolicy(
      'tr(@0/**)',
      `[${masterFingerPrint}/86'/${coinType}'/0']${extendedPublicKey}`,
    );

    const psbt = transaction.toPSBT(0);
    const psbtBase64 = base64.encode(psbt);
    const signatures = await app.signPsbt(psbtBase64, accountPolicy, null);

    for (const signature of signatures) {
      transaction.updateInput(signature[0], {
        tapKeySig: signature[1].signature,
      });
    }
  }
}

export class TransactionContext {
  private _paymentAddress!: AddressContext;

  private _ordinalsAddress!: AddressContext;

  private _network!: NetworkType;

  constructor(network: NetworkType, paymentAddressContext: AddressContext, ordinalsAddressContext: AddressContext) {
    this._paymentAddress = paymentAddressContext;
    this._ordinalsAddress = ordinalsAddressContext;

    this._network = network;
  }

  get paymentAddress(): AddressContext {
    return this._paymentAddress;
  }

  get ordinalsAddress(): AddressContext {
    return this._ordinalsAddress;
  }

  get changeAddress(): string {
    return this._paymentAddress.address;
  }

  get network(): NetworkType {
    return this._network;
  }

  async getUtxo(outpoint: string): Promise<{ extendedUtxo?: ExtendedUtxo; addressContext?: AddressContext }> {
    for (const addressContext of [this._paymentAddress, this._ordinalsAddress]) {
      const extendedUtxo = await addressContext.getUtxo(outpoint);

      if (extendedUtxo) {
        return { extendedUtxo, addressContext };
      }
    }

    return {};
  }

  async getInscriptionUtxo(
    inscriptionId: string,
  ): Promise<{ extendedUtxo?: ExtendedUtxo; addressContext?: AddressContext }> {
    for (const addressContext of [this._paymentAddress, this._ordinalsAddress]) {
      const extendedUtxos = await addressContext.getUtxos();

      for (const extendedUtxo of extendedUtxos) {
        const bundle = await extendedUtxo.getBundleData();

        if (
          bundle?.sat_ranges.some((satRange) =>
            satRange.inscriptions.some((inscription) => inscription.id === inscriptionId),
          )
        ) {
          return { extendedUtxo, addressContext };
        }
      }
    }

    return {};
  }

  addOutputAddress(transaction: btc.Transaction, address: string, amount: bigint): void {
    transaction.addOutputAddress(address, amount, this._network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }
}

const createAddressContext = (
  address: string,
  publicKey: string,
  network: NetworkType,
  accountIndex: bigint,
  seedVault: SeedVault,
  utxoCache: UtxoCache,
  accountType?: AccountType,
  transport?: LedgerTransport,
): AddressContext => {
  const { type } = getAddressInfo(address);

  if (accountType === 'ledger') {
    if (!transport) {
      throw new Error('Ledger transport required for ledger address');
    }

    if (type === AddressType.p2wpkh) {
      return new LedgerP2wpkhAddressContext(address, publicKey, network, accountIndex, seedVault, utxoCache, transport);
    }
    if (type === AddressType.p2tr) {
      return new LedgerP2trAddressContext(address, publicKey, network, accountIndex, seedVault, utxoCache, transport);
    } else {
      throw new Error(`Ledger support for this type of address not implemented: ${type}`);
    }
  }

  if (type === AddressType.p2sh) {
    return new P2shAddressContext(address, publicKey, network, accountIndex, seedVault, utxoCache);
  } else if (type === AddressType.p2wpkh) {
    return new P2wpkhAddressContext(address, publicKey, network, accountIndex, seedVault, utxoCache);
  } else if (type === AddressType.p2tr) {
    return new P2trAddressContext(address, publicKey, network, accountIndex, seedVault, utxoCache);
  } else {
    throw new Error('Unsupported payment address type');
  }
};

export type TransactionContextOptions = {
  wallet: WalletContext;
  seedVault: SeedVault;
  utxoCache: UtxoCache;
  network: NetworkType;
  ledgerTransport?: LedgerTransport;
};
export const createTransactionContext = (options: TransactionContextOptions) => {
  const { wallet, seedVault, utxoCache, network, ledgerTransport } = options;

  const paymentAddress = createAddressContext(
    wallet.btcAddress,
    wallet.btcPublicKey,
    network,
    wallet.accountIndex,
    seedVault,
    utxoCache,
    wallet.accountType,
    ledgerTransport,
  );
  const ordinalsAddress =
    wallet.btcAddress === wallet.ordinalsAddress
      ? paymentAddress
      : createAddressContext(
          wallet.ordinalsAddress,
          wallet.ordinalsPublicKey,
          network,
          wallet.accountIndex,
          seedVault,
          utxoCache,
          wallet.accountType,
          ledgerTransport,
        );

  return new TransactionContext(network, paymentAddress, ordinalsAddress);
};
