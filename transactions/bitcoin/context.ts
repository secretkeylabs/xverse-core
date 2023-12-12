import * as secp256k1 from '@noble/secp256k1';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import * as bip39 from 'bip39';
import AppClient, { DefaultWalletPolicy } from 'ledger-bitcoin';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../../constant';
import { Transport } from '../../ledger/types';
import SeedVault from '../../seedVault';
import { getBtcNetwork } from '../../transactions/btcNetwork';
import { type NetworkType, type RareSatsType, type UTXO, type UtxoOrdinalBundle } from '../../types';
import { bip32 } from '../../utils/bip32';
import { getBitcoinDerivationPath, getSegwitDerivationPath, getTaprootDerivationPath } from '../../wallet';
import { CompilationOptions, SupportedAddressType } from './types';
import { areByteArraysEqual, getOutpointFromUtxo } from './utils';

export type SignOptions = {
  ledgerTransport?: Transport;
  allowedSighash?: btc.SigHash[];
};

export class ExtendedUtxo {
  private _utxo!: UTXO;

  private _address!: string;

  private _outpoint!: string;

  private _hex!: string;

  private _utxoCache!: UtxoCache;

  private _esploraApiProvider!: EsploraProvider;

  private _isExternal!: boolean;

  private _bundleData?: UtxoOrdinalBundle<RareSatsType>;

  get address(): string {
    return this._address;
  }

  constructor(
    utxo: UTXO,
    address: string,
    utxoCache: UtxoCache,
    esploraApiProvider: EsploraProvider,
    isExternal = false,
  ) {
    this._utxo = utxo;
    this._address = address;
    this._outpoint = getOutpointFromUtxo(utxo);
    this._utxoCache = utxoCache;
    this._esploraApiProvider = esploraApiProvider;
    this._isExternal = isExternal;
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
        this._hex = await this._esploraApiProvider.getTransactionHex(this._utxo.txid);

        resolve(this._hex);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * If the underlying UTXO is unconfirmed, this method will return the total fee and vsize of the unconfirmed chain
   */
  async getUnconfirmedUtxoFeeData(): Promise<{ totalVsize: number; totalFee: number }> {
    if (this.utxo.status.confirmed) {
      return {
        totalVsize: 0,
        totalFee: 0,
      };
    }

    const txidsToTest = [this.utxo.txid];

    let totalVsize = 0;
    let totalFee = 0;

    while (txidsToTest.length > 0) {
      const toTestInThisRound = txidsToTest.splice(0, 10); // we get 10 txns at a time to avoid DDOSing the API
      const txns = await Promise.all(toTestInThisRound.map(this._esploraApiProvider.getTransaction));

      for (const tx of txns) {
        if (tx.status.confirmed) {
          continue;
        }

        totalVsize += tx.weight / 4;
        totalFee += tx.fee;

        txidsToTest.push(...tx.vin.map((vin) => vin.txid));
      }
    }

    return {
      totalVsize,
      totalFee,
    };
  }

  async getBundleData(): Promise<UtxoOrdinalBundle<RareSatsType> | undefined> {
    if (!this._bundleData) {
      const bundleData = await this._utxoCache.getUtxoByOutpoint(this._outpoint, this._address, this._isExternal);
      if (bundleData) {
        this._bundleData = bundleData;
      }
    }
    return this._bundleData;
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

  protected _accountIndex!: number;

  protected _esploraApiProvider!: EsploraProvider;

  constructor(
    type: SupportedAddressType,
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: number,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    esploraApiProvider: EsploraProvider,
  ) {
    this._type = type;
    this._address = address;
    this._publicKey = publicKey;
    this._network = network;
    this._seedVault = seedVault;
    this._utxoCache = utxoCache;
    this._accountIndex = accountIndex;
    this._esploraApiProvider = esploraApiProvider;
  }

  get type(): SupportedAddressType {
    return this._type;
  }

  get address(): string {
    return this._address;
  }

  async getUtxos(): Promise<ExtendedUtxo[]> {
    if (!this._utxos) {
      const utxos = await this._esploraApiProvider.getUnspentUtxos(this._address);

      this._utxos = utxos.map(
        (utxo) => new ExtendedUtxo(utxo, this._address, this._utxoCache, this._esploraApiProvider),
      );
    }

    return [...this._utxos];
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

  // helper method to get an extended UTXO for another address
  async getExternalUtxo(outPoint: string): Promise<ExtendedUtxo | undefined> {
    const [txid, vout] = outPoint.split(':');
    const [tx, outspends] = await Promise.all([
      this._esploraApiProvider.getTransaction(txid),
      this._esploraApiProvider.getTransactionOutspends(txid),
    ]);

    if (!tx) {
      return undefined;
    }

    const outspend = outspends[+vout];
    if (outspend?.spent) {
      // this is no longer a UTXO as it is spent
      return undefined;
    }

    const output = tx.vout[+vout];

    const address = output.scriptpubkey_address!;

    const utxo: UTXO = {
      txid,
      vout: +vout,
      value: output.value,
      status: tx.status,
      address,
    };

    return new ExtendedUtxo(utxo, address, this._utxoCache, this._esploraApiProvider, true);
  }

  protected async getPrivateKey(seedPhrase: string): Promise<string> {
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    const master = bip32.fromSeed(seed);

    const btcChild = master.derivePath(this.getDerivationPath());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return btcChild.privateKey!.toString('hex');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by subclasses
  async prepareInputs(_transaction: btc.Transaction, _options: SignOptions): Promise<void> {
    // no-op
    // this can be implemented by subclasses if they need to do something before signing
  }

  protected abstract getDerivationPath(): string;
  abstract addInput(transaction: btc.Transaction, utxo: ExtendedUtxo, options?: CompilationOptions): Promise<void>;
  abstract signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void>;
  abstract toDummyInputs(transaction: btc.Transaction, privateKey: Uint8Array): Promise<void>;
}

export class P2shAddressContext extends AddressContext {
  private _p2sh!: ReturnType<typeof btc.p2sh>;

  constructor(
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: number,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    esploraApiProvider: EsploraProvider,
  ) {
    super('p2sh', address, publicKey, network, accountIndex, seedVault, utxoCache, esploraApiProvider);

    const publicKeyBuff = hex.decode(publicKey);

    const p2wpkh = btc.p2wpkh(publicKeyBuff, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);

    this._p2sh = btc.p2sh(p2wpkh, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }

  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const utxo = extendedUtxo.utxo;
    const nonWitnessUtxo = Buffer.from(await extendedUtxo.hex, 'hex');

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2sh.script,
        amount: BigInt(utxo.value),
      },
      redeemScript: this._p2sh.redeemScript,
      witnessScript: this._p2sh.witnessScript,
      nonWitnessUtxo,
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by subclasses
  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2sh.script)) {
        transaction.signIdx(hex.decode(privateKey), i, options.allowedSighash);
      }
    }
  }

  async toDummyInputs(transaction: btc.Transaction, privateKey: Uint8Array): Promise<void> {
    const btcNetwork = getBtcNetwork(this._network);
    const p2wpkh = btc.p2wpkh(secp256k1.getPublicKey(privateKey, true), btcNetwork);
    const p2sh = btc.p2sh(p2wpkh, btcNetwork);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2sh.script)) {
        transaction.updateInput(i, {
          witnessUtxo: {
            script: p2sh.script,
            amount: input.witnessUtxo?.amount ?? 0n,
          },
          redeemScript: p2sh.redeemScript,
          witnessScript: p2sh.witnessScript,
          nonWitnessUtxo: undefined,
        });
      }
    }
  }

  protected getDerivationPath(): string {
    return getBitcoinDerivationPath({ index: this._accountIndex, network: this._network });
  }
}

export class P2wpkhAddressContext extends AddressContext {
  protected _p2wpkh!: ReturnType<typeof btc.p2wpkh>;

  constructor(
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: number,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    esploraApiProvider: EsploraProvider,
  ) {
    super('p2wpkh', address, publicKey, network, accountIndex, seedVault, utxoCache, esploraApiProvider);

    const publicKeyBuff = hex.decode(publicKey);

    this._p2wpkh = btc.p2wpkh(publicKeyBuff, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }

  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const utxo = extendedUtxo.utxo;
    const nonWitnessUtxo = Buffer.from(await extendedUtxo.hex, 'hex');

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2wpkh.script,
        amount: BigInt(utxo.value),
      },
      nonWitnessUtxo,
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by subclasses
  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2wpkh.script)) {
        transaction.signIdx(hex.decode(privateKey), i, options.allowedSighash);
      }
    }
  }

  async toDummyInputs(transaction: btc.Transaction, privateKey: Uint8Array): Promise<void> {
    const btcNetwork = getBtcNetwork(this._network);
    const p2wpkh = btc.p2wpkh(secp256k1.getPublicKey(privateKey, true), btcNetwork);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2wpkh.script)) {
        transaction.updateInput(i, {
          witnessUtxo: {
            script: p2wpkh.script,
            amount: input.witnessUtxo?.amount ?? 0n,
          },
          nonWitnessUtxo: undefined,
        });
      }
    }
  }

  protected getDerivationPath(): string {
    return getSegwitDerivationPath({ index: this._accountIndex, network: this._network });
  }
}

export class LedgerP2wpkhAddressContext extends P2wpkhAddressContext {
  async prepareInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const app = new AppClient(ledgerTransport);
    const masterFingerPrint = await app.getMasterFingerprint();

    const inputDerivation = [
      Buffer.from(this._publicKey, 'hex'),
      {
        path: btc.bip32Path(this.getDerivationPath()),
        fingerprint: parseInt(masterFingerPrint, 16),
      },
    ] as [Uint8Array, { path: number[]; fingerprint: number }];

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2wpkh.script)) {
        transaction.updateInput(i, {
          bip32Derivation: [inputDerivation],
        });
      }
    }
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
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

    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const app = new AppClient(ledgerTransport);
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
    accountIndex: number,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    esploraApiProvider: EsploraProvider,
  ) {
    super('p2tr', address, publicKey, network, accountIndex, seedVault, utxoCache, esploraApiProvider);
    const publicKeyBuff = hex.decode(publicKey);

    try {
      this._p2tr = btc.p2tr(publicKeyBuff, undefined, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
    } catch (err) {
      if (err instanceof Error && err.message.includes('schnorr')) {
        // ledger gives us the non-schnorr pk, so we need to remove the first byte
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
    const nonWitnessUtxo = Buffer.from(await extendedUtxo.hex, 'hex');

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2tr.script,
        amount: BigInt(utxo.value),
      },
      tapInternalKey: hex.decode(this._publicKey),
      nonWitnessUtxo,
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by subclasses
  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const seedPhrase = await this._seedVault.getSeed();
    const privateKey = await this.getPrivateKey(seedPhrase);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2tr.script)) {
        transaction.signIdx(hex.decode(privateKey), i, options.allowedSighash);
      }
    }
  }

  async toDummyInputs(transaction: btc.Transaction, privateKey: Uint8Array): Promise<void> {
    const btcNetwork = getBtcNetwork(this._network);
    const dummyPublicKey = secp256k1.getPublicKey(privateKey, true);
    const p2tr = btc.p2tr(dummyPublicKey.slice(1), undefined, btcNetwork);

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2tr.script)) {
        transaction.updateInput(i, {
          witnessUtxo: {
            script: p2tr.script,
            amount: input.witnessUtxo?.amount ?? 0n,
          },
          tapInternalKey: p2tr.tapInternalKey,
          nonWitnessUtxo: undefined,
        });
      }
    }
  }

  protected getDerivationPath(): string {
    return getTaprootDerivationPath({ index: this._accountIndex, network: this._network });
  }
}

export class LedgerP2trAddressContext extends P2trAddressContext {
  async addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo, options?: CompilationOptions) {
    const utxo = extendedUtxo.utxo;
    const nonWitnessUtxo = Buffer.from(await extendedUtxo.hex, 'hex');

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
    });
  }

  async prepareInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const app = new AppClient(ledgerTransport);
    const masterFingerPrint = await app.getMasterFingerprint();

    const inputDerivation = [
      hex.decode(this._publicKey),
      {
        path: btc.bip32Path(this.getDerivationPath()),
        fingerprint: parseInt(masterFingerPrint, 16),
      },
    ] as [Uint8Array, { path: number[]; fingerprint: number }];

    for (let i = 0; i < transaction.inputsLength; i++) {
      const input = transaction.getInput(i);
      if (areByteArraysEqual(input.witnessUtxo?.script, this._p2tr.script)) {
        transaction.updateInput(i, {
          bip32Derivation: [inputDerivation],
        });
      }
    }
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
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

    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const app = new AppClient(ledgerTransport);
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

  private _addressList!: AddressContext[];

  constructor(network: NetworkType, paymentAddressContext: AddressContext, ordinalsAddressContext: AddressContext) {
    this._paymentAddress = paymentAddressContext;
    this._ordinalsAddress = ordinalsAddressContext;

    this._addressList = [this._paymentAddress];

    if (paymentAddressContext !== ordinalsAddressContext) {
      this._addressList.push(this._ordinalsAddress);
    }

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
    for (const addressContext of this._addressList) {
      const extendedUtxo = await addressContext.getUtxo(outpoint);

      if (extendedUtxo) {
        return { extendedUtxo, addressContext };
      }
    }

    return {};
  }

  async getUtxoFallbackToExternal(
    outpoint: string,
  ): Promise<{ extendedUtxo?: ExtendedUtxo; addressContext?: AddressContext }> {
    const utxoData = await this.getUtxo(outpoint);

    if (utxoData.extendedUtxo) {
      return utxoData;
    }

    const extendedUtxo = await this.paymentAddress.getExternalUtxo(outpoint);

    return { extendedUtxo };
  }

  async getInscriptionUtxo(
    inscriptionId: string,
  ): Promise<{ extendedUtxo?: ExtendedUtxo; addressContext?: AddressContext }> {
    for (const addressContext of this._addressList) {
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

  async signTransaction(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    await this.paymentAddress.prepareInputs(transaction, options);
    await this.ordinalsAddress.prepareInputs(transaction, options);

    await this.paymentAddress.signInputs(transaction, options);
    await this.ordinalsAddress.signInputs(transaction, options);
  }

  async signPsbt(psbtBase64: string, options: SignOptions): Promise<string> {
    const txn = btc.Transaction.fromPSBT(Buffer.from(psbtBase64, 'base64'));

    await this.signTransaction(txn, options);

    const psbt = txn.toPSBT();
    const psbtBase64Signed = base64.encode(psbt);

    return psbtBase64Signed;
  }

  async dummySignTransaction(transaction: btc.Transaction) {
    const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';
    const dummyPrivateKeyBuffer = hex.decode(dummyPrivateKey);

    await this.paymentAddress.toDummyInputs(transaction, dummyPrivateKeyBuffer);
    await this.ordinalsAddress.toDummyInputs(transaction, dummyPrivateKeyBuffer);

    if (transaction.inputsLength > 0) {
      transaction.sign(dummyPrivateKeyBuffer);
    }
  }
}
