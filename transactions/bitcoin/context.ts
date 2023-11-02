import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';

import * as bip39 from 'bip39';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import SeedVault from '../../seedVault';
import type { NetworkType, UTXO, UtxoOrdinalBundle } from '../../types';
import { bip32 } from '../../utils/bip32';
import { getBtcTaprootPrivateKey } from '../../wallet';

import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE, BTC_WRAPPED_SEGWIT_PATH_PURPOSE } from '../../constant';
import { CompilationOptions, SupportedAddressType, WalletContext } from './types';
import { getOutpointFromUtxo } from './utils';

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
  private _utxo!: UTXO;

  private _address!: string;

  private _outpoint!: string;

  private _utxoCache!: UtxoCache;

  constructor(utxo: UTXO, address: string, utxoCache: UtxoCache) {
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

      this._utxos = utxos.map((utxo) => new ExtendedUtxo(utxo, this._address, this._utxoCache));
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

  protected getTaprootDerivationPath({
    account,
    index,
    network,
  }: {
    account?: bigint;
    index: bigint;
    network: NetworkType;
  }) {
    const accountIndex = account ? account.toString() : '0';

    return network === 'Mainnet'
      ? `${BTC_TAPROOT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
      : `${BTC_TAPROOT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
  }

  protected async getPrivateKey(seedPhrase: string): Promise<string> {
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    const master = bip32.fromSeed(seed);

    const btcChild = master.derivePath(this.getDerivationPath());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return btcChild.privateKey!.toString('hex');
  }

  protected abstract getDerivationPath(): string;
  abstract addInput(transaction: btc.Transaction, utxo: ExtendedUtxo, options?: CompilationOptions): void;
  abstract signInput(transaction: btc.Transaction, index: number): Promise<void>;
}

class P2shAddressContext extends AddressContext {
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

  addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions): void {
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

  async signInput(transaction: btc.Transaction, index: number): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);
    transaction.signIdx(hex.decode(privateKey), index);
  }

  protected getDerivationPath(): string {
    return this._network === 'Mainnet'
      ? `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}0'/0'/0/${this._accountIndex}`
      : `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}1'/0'/0/${this._accountIndex}`;
  }
}

class P2wpkhAddressContext extends AddressContext {
  private _p2wpkh!: ReturnType<typeof btc.p2wpkh>;

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

  addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions): void {
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

  async signInput(transaction: btc.Transaction, index: number): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);
    transaction.signIdx(hex.decode(privateKey), index);
  }

  protected getDerivationPath(): string {
    return this._network === 'Mainnet'
      ? `${BTC_SEGWIT_PATH_PURPOSE}0'/0'/0/${this._accountIndex}`
      : `${BTC_SEGWIT_PATH_PURPOSE}1'/0'/0/${this._accountIndex}`;
  }
}

class P2trAddressContext extends AddressContext {
  private _p2tr!: ReturnType<typeof btc.p2tr>;

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

    this._p2tr = btc.p2tr(publicKeyBuff, undefined, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }

  addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions): void {
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

  async signInput(transaction: btc.Transaction, index: number): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await getBtcTaprootPrivateKey({
      seedPhrase,
      index: this._accountIndex,
      network: this._network,
    });
    transaction.signIdx(hex.decode(privateKey), index);
  }

  protected getDerivationPath(): string {
    return this._network === 'Mainnet'
      ? `${BTC_TAPROOT_PATH_PURPOSE}0'/0'/0/${this._accountIndex}`
      : `${BTC_TAPROOT_PATH_PURPOSE}1'/0'/0/${this._accountIndex}`;
  }
}

const createAddressContext = (
  address: string,
  publicKey: string,
  network: NetworkType,
  accountIndex: bigint,
  seedVault: SeedVault,
  utxoCache: UtxoCache,
): AddressContext => {
  const { type } = getAddressInfo(address);

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

export class TransactionContext {
  private _paymentAddress!: AddressContext;

  private _ordinalsAddress!: AddressContext;

  private _network!: NetworkType;

  constructor(
    wallet: WalletContext,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    network: NetworkType,
    accountIndex: bigint,
  ) {
    this._paymentAddress = createAddressContext(
      wallet.btcAddress,
      wallet.btcPublicKey,
      network,
      accountIndex,
      seedVault,
      utxoCache,
    );
    this._ordinalsAddress =
      wallet.btcAddress === wallet.ordinalsAddress
        ? this._paymentAddress
        : createAddressContext(
            wallet.ordinalsAddress,
            wallet.ordinalsPublicKey,
            network,
            accountIndex,
            seedVault,
            utxoCache,
          );

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

  addOutputAddress(transaction: btc.Transaction, address: string, amount: bigint): void {
    transaction.addOutputAddress(address, amount, this._network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }
}
