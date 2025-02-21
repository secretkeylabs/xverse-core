import Bitcoin from '@keystonehq/hw-app-bitcoin';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { taprootTweakPrivKey } from '@scure/btc-signer/utils';
import { Mutex } from 'async-mutex';
import { isAxiosError } from 'axios';
import AppClient, { DefaultWalletPolicy } from 'ledger-bitcoin';
import { getNativeSegwitDerivationPath, getNestedSegwitDerivationPath, getTaprootDerivationPath } from '../../account';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../../constant';
import { KeystoneTransport } from '../../keystone';
import { LedgerTransport } from '../../ledger';
import { AccountType, type NetworkType, type UTXO } from '../../types';
import { DerivationType, SeedVault, WalletId } from '../../vaults';
import { getBtcNetworkDefinition } from '../btcNetwork';
import { ExtendedUtxo } from './extendedUtxo';
import { CompilationOptions, SupportedAddressType } from './types';
import { areByteArraysEqual } from './utils';

export type InputToSign = {
  address: string;
  signingIndexes: Array<number>;
  sigHash?: number;
};

export type SignOptions = {
  ledgerTransport?: LedgerTransport;
  keystoneTransport?: KeystoneTransport;
  inputsToSign?: InputToSign[];
};

type BaseAddressContextConstructorArgs = {
  esploraApiProvider: EsploraProvider;
  address: string;
  publicKey: string;
  network: NetworkType;
  accountIndex: number;
  derivationType: DerivationType;
  seedVault: SeedVault;
  utxoCache: UtxoCache;
  accountType?: AccountType;
};

type HardwareAddressContextConstructorArgs = BaseAddressContextConstructorArgs & {
  accountType: 'ledger' | 'keystone';
  masterFingerprint?: string;
};

type SoftwareAddressContextConstructorArgs = BaseAddressContextConstructorArgs & {
  accountType?: 'software';
  walletId: WalletId;
};

export type AddressContextConstructorArgs =
  | HardwareAddressContextConstructorArgs
  | SoftwareAddressContextConstructorArgs;

export abstract class AddressContext {
  protected _type: SupportedAddressType;

  protected _address: string;

  protected _publicKey: string;

  protected _network: NetworkType;

  private _utxos?: ExtendedUtxo[];

  protected _seedVault: SeedVault;

  protected _utxoCache: UtxoCache;

  protected _accountIndex: number;

  protected _derivationType: DerivationType;

  protected _esploraApiProvider: EsploraProvider;

  protected _getUtxoMutex: Mutex = new Mutex();

  constructor(addressType: SupportedAddressType, args: AddressContextConstructorArgs) {
    this._type = addressType;
    this._address = args.address;
    this._publicKey = args.publicKey;
    this._network = args.network;
    this._seedVault = args.seedVault;
    this._utxoCache = args.utxoCache;
    this._accountIndex = args.accountIndex;
    this._derivationType = args.derivationType;
    this._esploraApiProvider = args.esploraApiProvider;
  }

  get type(): SupportedAddressType {
    return this._type;
  }

  get address(): string {
    return this._address;
  }

  async getUtxos(): Promise<ExtendedUtxo[]> {
    const release = await this._getUtxoMutex.acquire();
    try {
      if (!this._utxos) {
        const utxos = await this._esploraApiProvider.getUnspentUtxos(this._address);

        this._utxos = utxos.map(
          (utxo) => new ExtendedUtxo(utxo, this._address, this._utxoCache, this._esploraApiProvider),
        );
      }

      return [...this._utxos];
    } finally {
      release();
    }
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
    const tx = await this._esploraApiProvider.getTransaction(txid).catch((e) => {
      if (isAxiosError(e) && e.response && e.response.status === 404) {
        return undefined;
      }
      throw e;
    });

    if (!tx) {
      return undefined;
    }

    const outspends = await this._esploraApiProvider.getTransactionOutspends(txid);

    if (!outspends) {
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

  async constructUtxo(utxo: Omit<UTXO, 'address'>): Promise<ExtendedUtxo> {
    const addressUtxo = {
      ...utxo,
      address: this._address,
    };
    const extendedUtxo = new ExtendedUtxo(addressUtxo, this._address, this._utxoCache, this._esploraApiProvider);

    return extendedUtxo;
  }

  protected getDerivationParams() {
    return this._derivationType === 'account'
      ? { accountIndex: this._accountIndex, index: 0n }
      : { index: this._accountIndex, accountIndex: 0n };
  }

  protected async getPrivateKey(walletId: WalletId): Promise<Uint8Array> {
    const { rootNode } = await this._seedVault.getWalletRootNode(walletId);

    const btcChild = rootNode.derive(this.getDerivationPath());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return btcChild.privateKey!;
  }

  protected getSignIndexes(
    transaction: btc.Transaction,
    options: SignOptions,
    lockingScript?: Uint8Array,
  ): Record<number, btc.SigHash[] | undefined> {
    const signIndexes: Record<number, btc.SigHash[] | undefined> = {};

    if (options.inputsToSign) {
      // This is the path use by sats-connect for external parties wanting to sign a transaction
      for (const inputToSign of options.inputsToSign) {
        if (inputToSign.address === this._address) {
          inputToSign.signingIndexes.forEach((index) => {
            if (signIndexes[index]) {
              throw new Error(`Duplicate signing index ${index} for address ${this._address}`);
            }
            const input = transaction.getInput(index);

            signIndexes[index] = undefined;
            if (input.sighashType !== undefined) {
              signIndexes[index] = [input.sighashType];
            }
          });
        }
      }
    } else {
      // This is the internal path used by the wallet to sign transactions
      for (let i = 0; i < transaction.inputsLength; i++) {
        const input = transaction.getInput(i);

        const witnessLockingScript = input.witnessUtxo?.script;
        const matchesWitnessUtxo = areByteArraysEqual(witnessLockingScript, lockingScript);

        const nonWitnessLockingScript =
          (input.index !== undefined && input.nonWitnessUtxo?.outputs[input.index]?.script) || undefined;
        const matchesNonWitnessUtxo = areByteArraysEqual(nonWitnessLockingScript, lockingScript);

        if (matchesWitnessUtxo || matchesNonWitnessUtxo) {
          signIndexes[i] = undefined;
          if (input.sighashType !== undefined) {
            signIndexes[i] = [input.sighashType];
          }
        }
      }
    }

    return signIndexes;
  }

  protected getChangeIndexes(transaction: btc.Transaction, lockingScript?: Uint8Array): number[] {
    const changeIndexes: number[] = [];

    // This is the internal path used by the wallet to sign transactions
    for (let i = 0; i < transaction.outputsLength; i++) {
      const output = transaction.getOutput(i);

      const outputLockingScript = output?.script;
      const outputIsLockedByLockingScript = areByteArraysEqual(outputLockingScript, lockingScript);

      if (outputIsLockedByLockingScript) {
        changeIndexes.push(i);
      }
    }

    return changeIndexes;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by subclasses
  async prepareInputs(_transaction: btc.Transaction, _options: SignOptions): Promise<void> {
    // no-op
    // this can be implemented by subclasses if they need to do something before signing
  }

  protected abstract getDerivationPath(): string;
  abstract getIOSizes(): { inputSize: number; outputSize: number };
  abstract addInput(transaction: btc.Transaction, utxo: ExtendedUtxo, options?: CompilationOptions): Promise<void>;
  abstract signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void>;
}

abstract class P2shAddressContext extends AddressContext {
  protected _p2sh!: ReturnType<typeof btc.p2sh>;

  constructor(args: AddressContextConstructorArgs) {
    super('p2sh', args);

    const publicKeyBuff = hex.decode(this._publicKey);

    const p2wpkh = btc.p2wpkh(publicKeyBuff, getBtcNetworkDefinition(this._network));

    this._p2sh = btc.p2sh(p2wpkh, getBtcNetworkDefinition(this._network));
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

  protected getDerivationPath(): string {
    const derivationParams = this.getDerivationParams();
    return getNestedSegwitDerivationPath({ ...derivationParams, network: this._network });
  }

  getIOSizes(): { inputSize: number; outputSize: number } {
    return { inputSize: 91, outputSize: 32 };
  }
}

export class SoftwareP2shAddressContext extends P2shAddressContext {
  protected _walletId: WalletId;

  constructor(args: SoftwareAddressContextConstructorArgs) {
    super(args);
    this._walletId = args.walletId;
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const privateKey = await this.getPrivateKey(this._walletId);

    const signIndexes = this.getSignIndexes(transaction, options, this._p2sh.script);

    for (const [i, allowedSigHash] of Object.entries(signIndexes)) {
      transaction.signIdx(privateKey, +i, allowedSigHash);
    }
  }
}

abstract class P2wpkhAddressContext extends AddressContext {
  protected _p2wpkh!: ReturnType<typeof btc.p2wpkh>;

  constructor(args: AddressContextConstructorArgs) {
    super('p2wpkh', args);

    const publicKeyBuff = hex.decode(this._publicKey);

    this._p2wpkh = btc.p2wpkh(publicKeyBuff, getBtcNetworkDefinition(this._network));
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

  protected getDerivationPath(): string {
    const derivationParams = this.getDerivationParams();
    return getNativeSegwitDerivationPath({ ...derivationParams, network: this._network });
  }

  getIOSizes(): { inputSize: number; outputSize: number } {
    return { inputSize: 68, outputSize: 31 };
  }
}

export class SoftwareP2wpkhAddressContext extends P2wpkhAddressContext {
  protected _walletId: WalletId;

  constructor(args: SoftwareAddressContextConstructorArgs) {
    super(args);
    this._walletId = args.walletId;
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const privateKey = await this.getPrivateKey(this._walletId);

    const signIndexes = this.getSignIndexes(transaction, options, this._p2wpkh.script);

    for (const [i, allowedSigHash] of Object.entries(signIndexes)) {
      transaction.signIdx(privateKey, +i, allowedSigHash);
    }
  }
}

export class LedgerP2wpkhAddressContext extends P2wpkhAddressContext {
  protected _masterFingerprint?: string;

  constructor(args: HardwareAddressContextConstructorArgs) {
    super(args);

    this._masterFingerprint = args.masterFingerprint;
  }

  async prepareInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const masterFingerPrint = this._masterFingerprint ?? (await new AppClient(ledgerTransport).getMasterFingerprint());

    const inputDerivation = [
      Buffer.from(this._publicKey, 'hex'),
      {
        path: btc.bip32Path(this.getDerivationPath()),
        fingerprint: parseInt(masterFingerPrint, 16),
      },
    ] as [Uint8Array, { path: number[]; fingerprint: number }];

    const signIndexes = this.getSignIndexes(transaction, options, this._p2wpkh.script);

    for (const i of Object.keys(signIndexes)) {
      const input = transaction.getInput(+i);
      if (input.bip32Derivation?.some((derivation) => areByteArraysEqual(derivation[0], inputDerivation[0]))) {
        continue;
      }

      transaction.updateInput(+i, {
        bip32Derivation: [inputDerivation],
      });
    }
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const signIndexes = this.getSignIndexes(transaction, options, this._p2wpkh.script);

    if (Object.keys(signIndexes).length === 0) {
      return;
    }

    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const app = new AppClient(ledgerTransport);
    const masterFingerPrint = this._masterFingerprint ?? (await app.getMasterFingerprint());
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

export class KeystoneP2wpkhAddressContext extends P2wpkhAddressContext {
  protected _masterFingerprint?: string;

  constructor(args: HardwareAddressContextConstructorArgs) {
    super(args);

    this._masterFingerprint = args.masterFingerprint;
  }

  async prepareInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const { keystoneTransport } = options;
    if (!keystoneTransport) {
      throw new Error('keystoneTransport is required for Keystone signing');
    }

    const masterFingerPrint = this._masterFingerprint ?? (await new Bitcoin(keystoneTransport).getMasterFingerprint());

    const inputDerivation = [
      Buffer.from(this._publicKey, 'hex'),
      {
        path: btc.bip32Path(this.getDerivationPath()),
        fingerprint: parseInt(masterFingerPrint, 16),
      },
    ] as [Uint8Array, { path: number[]; fingerprint: number }];

    const signIndexes = this.getSignIndexes(transaction, options, this._p2wpkh.script);

    for (const i of Object.keys(signIndexes)) {
      const input = transaction.getInput(+i);
      if (input.bip32Derivation?.some((derivation) => areByteArraysEqual(derivation[0], inputDerivation[0]))) {
        continue;
      }

      transaction.updateInput(+i, {
        bip32Derivation: [inputDerivation],
      });
    }

    const changeIndexes = this.getChangeIndexes(transaction, this._p2wpkh.script);

    for (const i of changeIndexes) {
      const output = transaction.getOutput(+i);
      const bip32Derivation = output.bip32Derivation ?? [];
      if (bip32Derivation.some((derivation) => areByteArraysEqual(derivation[0], inputDerivation[0]))) {
        continue;
      }

      bip32Derivation.push(inputDerivation);

      transaction.updateOutput(+i, {
        bip32Derivation,
      });
    }
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const signIndexes = this.getSignIndexes(transaction, options, this._p2wpkh.script);

    if (Object.keys(signIndexes).length === 0) {
      return;
    }

    const { keystoneTransport } = options;
    if (!keystoneTransport) {
      throw new Error('keystoneTransport is required for Keystone signing');
    }

    const keystoneBitcoin = new Bitcoin(keystoneTransport);

    const psbt = transaction.toPSBT(0);
    const psbtBase64 = base64.encode(psbt);

    const cleanedPsbtBase64 = this.cleanPsbtInputSig(psbtBase64);

    const signedPsbtBase64 = await keystoneBitcoin.signPsbtRaw(cleanedPsbtBase64);
    const signedPsbt = btc.Transaction.fromPSBT(base64.decode(signedPsbtBase64));

    for (const signIndex of Object.keys(signIndexes)) {
      const input = signedPsbt.getInput(+signIndex);
      const signature = input.partialSig?.[0];

      if (!signature) {
        throw new Error(`Signature not found for input ${signIndex}`);
      }

      const partialSig = input.partialSig ?? [];
      partialSig.push(signature);

      transaction.updateInput(+signIndex, {
        partialSig,
      });
    }
  }

  cleanPsbtInputSig(psbtBase64: string) {
    // Keystone will reject the PSBT if the partialSig is populated for transactions it needs to sign, so we clear them
    const psbt = btc.Transaction.fromPSBT(base64.decode(psbtBase64));
    for (let i = 0; i < psbt.inputsLength; i++) {
      psbt.updateInput(i, {
        partialSig: undefined,
      });
    }

    return base64.encode(psbt.toPSBT());
  }
}

abstract class P2trAddressContext extends AddressContext {
  protected _p2tr!: ReturnType<typeof btc.p2tr>;

  constructor(args: AddressContextConstructorArgs) {
    super('p2tr', args);
    const publicKeyBuff = hex.decode(this._publicKey);

    try {
      this._p2tr = btc.p2tr(publicKeyBuff, undefined, getBtcNetworkDefinition(this._network));
    } catch (err) {
      if (err instanceof Error && err.message.includes('schnorr')) {
        // ledger gives us the non-schnorr pk, so we need to remove the first byte
        this._p2tr = btc.p2tr(publicKeyBuff.slice(1), undefined, getBtcNetworkDefinition(this._network));
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
      tapInternalKey: this._p2tr.tapInternalKey,
      sequence: options?.rbfEnabled ? 0xfffffffd : 0xffffffff,
    });
  }

  protected getDerivationPath(): string {
    const derivationParams = this.getDerivationParams();
    return getTaprootDerivationPath({ ...derivationParams, network: this._network });
  }

  getIOSizes(): { inputSize: number; outputSize: number } {
    return { inputSize: 57, outputSize: 43 };
  }
}

export class SoftwareP2trAddressContext extends P2trAddressContext {
  protected _walletId: WalletId;

  constructor(args: SoftwareAddressContextConstructorArgs) {
    super(args);
    this._walletId = args.walletId;
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const privateKey = await this.getPrivateKey(this._walletId);
    const tweakedPrivateKey = taprootTweakPrivKey(privateKey);

    const signIndexes = this.getSignIndexes(transaction, options, this._p2tr.script);

    for (const [i, allowedSigHash] of Object.entries(signIndexes)) {
      try {
        transaction.signIdx(privateKey, +i, allowedSigHash);
      } catch (e) {
        if (e.message !== 'No taproot scripts signed') {
          throw e;
        }

        // couldn't sign with private key, try sign with tweaked key
        try {
          transaction.signIdx(tweakedPrivateKey, +i, allowedSigHash);
        } catch {
          throw e;
        }
      }
    }
  }
}

export class LedgerP2trAddressContext extends P2trAddressContext {
  protected _masterFingerprint?: string;

  constructor(args: HardwareAddressContextConstructorArgs) {
    super(args);

    this._masterFingerprint = args.masterFingerprint;
  }

  async prepareInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const masterFingerPrint = this._masterFingerprint ?? (await new AppClient(ledgerTransport).getMasterFingerprint());

    const inputDerivation = [
      this._p2tr.tapInternalKey,
      {
        hashes: [],
        der: {
          path: btc.bip32Path(this.getDerivationPath()),
          fingerprint: parseInt(masterFingerPrint, 16),
        },
      },
    ] as [
      Uint8Array,
      {
        hashes: Uint8Array[];
        der: {
          fingerprint: any;
          path: any;
        };
      },
    ];

    const signIndexes = this.getSignIndexes(transaction, options, this._p2tr.script);

    for (const i of Object.keys(signIndexes)) {
      const input = transaction.getInput(+i);
      if (input.bip32Derivation?.some((derivation) => areByteArraysEqual(derivation[0], inputDerivation[0]))) {
        continue;
      }

      transaction.updateInput(+i, {
        tapBip32Derivation: [inputDerivation],
      });
    }
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const signIndexes = this.getSignIndexes(transaction, options, this._p2tr.script);

    if (Object.keys(signIndexes).length === 0) {
      return;
    }

    const { ledgerTransport } = options;
    if (!ledgerTransport) {
      throw new Error('Transport is required for Ledger signing');
    }

    const app = new AppClient(ledgerTransport);
    const masterFingerPrint = this._masterFingerprint ?? (await app.getMasterFingerprint());
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

export class KeystoneP2trAddressContext extends P2trAddressContext {
  protected _masterFingerprint?: string;

  constructor(args: HardwareAddressContextConstructorArgs) {
    super(args);

    this._masterFingerprint = args.masterFingerprint;
  }

  async prepareInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const { keystoneTransport } = options;
    if (!keystoneTransport) {
      throw new Error('keystoneTransport is required for Keystone signing');
    }

    const masterFingerPrint = this._masterFingerprint ?? (await new Bitcoin(keystoneTransport).getMasterFingerprint());

    const inputDerivation = [
      this._p2tr.tapInternalKey,
      {
        hashes: [],
        der: {
          path: btc.bip32Path(this.getDerivationPath()),
          fingerprint: parseInt(masterFingerPrint, 16),
        },
      },
    ] as [
      Uint8Array,
      {
        hashes: Uint8Array[];
        der: {
          fingerprint: any;
          path: any;
        };
      },
    ];

    const signIndexes = this.getSignIndexes(transaction, options, this._p2tr.script);

    for (const i of Object.keys(signIndexes)) {
      const input = transaction.getInput(+i);
      if (input.bip32Derivation?.some((derivation) => areByteArraysEqual(derivation[0], inputDerivation[0]))) {
        continue;
      }

      transaction.updateInput(+i, {
        tapBip32Derivation: [inputDerivation],
      });
    }

    const changeIndexes = this.getChangeIndexes(transaction, this._p2tr.script);

    for (const i of changeIndexes) {
      const output = transaction.getOutput(+i);
      const tapBip32Derivation = output.tapBip32Derivation ?? [];
      if (tapBip32Derivation.some((derivation) => areByteArraysEqual(derivation[0], inputDerivation[0]))) {
        continue;
      }

      tapBip32Derivation.push(inputDerivation);

      transaction.updateOutput(+i, {
        tapBip32Derivation,
      });
    }
  }

  async signInputs(transaction: btc.Transaction, options: SignOptions): Promise<void> {
    const signIndexes = this.getSignIndexes(transaction, options, this._p2tr.script);

    if (Object.keys(signIndexes).length === 0) {
      return;
    }

    const { keystoneTransport } = options;
    if (!keystoneTransport) {
      throw new Error('keystoneTransport is required for Keystone signing');
    }

    const keystoneBitcoin = new Bitcoin(keystoneTransport);
    const psbt = transaction.toPSBT(0);
    const psbtBase64 = base64.encode(psbt);

    const cleanedPsbtBase64 = this.cleanPsbtInputSig(psbtBase64);

    const signedPsbtBase64 = await keystoneBitcoin.signPsbtRaw(cleanedPsbtBase64);
    const signedPsbt = btc.Transaction.fromPSBT(base64.decode(signedPsbtBase64));

    for (const signIndex of Object.keys(signIndexes)) {
      const input = signedPsbt.getInput(+signIndex);
      const signature = input.tapKeySig;

      if (!signature) {
        throw new Error(`Signature not found for input ${signIndex}`);
      }

      transaction.updateInput(+signIndex, {
        tapKeySig: signature,
      });
    }
  }

  cleanPsbtInputSig(psbtBase64: string) {
    // Keystone will reject the PSBT if the partialSig is populated for transactions it needs to sign, so we clear them
    const psbt = btc.Transaction.fromPSBT(base64.decode(psbtBase64));
    for (let i = 0; i < psbt.inputsLength; i++) {
      psbt.updateInput(i, {
        partialSig: undefined,
      });
    }

    return base64.encode(psbt.toPSBT());
  }
}

export class TransactionContext {
  private _paymentAddress!: AddressContext;

  private _ordinalsAddress!: AddressContext;

  private _network!: NetworkType;

  private _addressList!: AddressContext[];

  protected _btcClient!: EsploraProvider;

  constructor(
    network: NetworkType,
    btcClient: EsploraProvider,
    paymentAddressContext: AddressContext,
    ordinalsAddressContext: AddressContext,
  ) {
    this._paymentAddress = paymentAddressContext;
    this._ordinalsAddress = ordinalsAddressContext;

    this._addressList = [this._paymentAddress];

    if (paymentAddressContext !== ordinalsAddressContext) {
      this._addressList.push(this._ordinalsAddress);
    }

    this._btcClient = btcClient;
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

  get btcClient(): EsploraProvider {
    return this._btcClient;
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
  ): Promise<{ extendedUtxo?: ExtendedUtxo; addressContext?: AddressContext } | undefined> {
    const utxoData = await this.getUtxo(outpoint);
    if (utxoData.extendedUtxo) {
      return utxoData;
    }

    try {
      const extendedUtxo = await this.paymentAddress.getExternalUtxo(outpoint);
      return { extendedUtxo };
    } catch (err) {
      if (isAxiosError(err) && err.response && err.response.status === 404) {
        return {};
      }

      throw err;
    }
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

  addOutputAddress(
    transaction: btc.Transaction,
    address: string,
    amount: bigint,
  ): { script: string[]; scriptHex: string } {
    transaction.addOutputAddress(address, amount, getBtcNetworkDefinition(this._network));

    const output = transaction.getOutput(transaction.outputsLength - 1);

    if (!output.script) {
      throw new Error('Output script is undefined');
    }

    const script = btc.Script.decode(output.script).map((i) => (i instanceof Uint8Array ? hex.encode(i) : `${i}`));
    const scriptHex = hex.encode(output.script);

    return { script, scriptHex };
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
}
