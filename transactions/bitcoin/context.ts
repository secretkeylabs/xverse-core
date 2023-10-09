import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';

import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { getOrdinalIdsFromUtxo } from '../../api/ordinals';
import OrdinalsProvider from '../../api/ordinals/provider';
import SeedVault from '../../seedVault';
import type { Inscription, NetworkType, UTXO } from '../../types';
import { processPromisesBatch } from '../../utils/promises';
import { getBtcPrivateKey, getBtcTaprootPrivateKey } from '../../wallet';

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

const ordinalsMainnetProvider = new OrdinalsProvider({
  network: 'Mainnet',
});

const ordinalsTestnetProvider = new OrdinalsProvider({
  network: 'Testnet',
});

const ordinalsApi = {
  Mainnet: ordinalsMainnetProvider,
  Testnet: ordinalsTestnetProvider,
};

type InscriptionId = string;

export class InscriptionContext {
  private _inscription!: Inscription;

  private _id!: InscriptionId;

  private _network!: NetworkType;

  constructor(id: InscriptionId, network: NetworkType) {
    this._id = id;
    this._network = network;
  }

  get id(): InscriptionId {
    return this._id;
  }

  get inscription(): Promise<Inscription> {
    return new Promise(async (resolve, reject) => {
      try {
        if (this._network === 'Testnet') {
          throw new Error('Inscriptions not available on testnet yet');
        }

        if (!this._inscription) {
          this._inscription = await ordinalsApi[this._network].getInscription(this._id);
        }
        resolve(this._inscription);
      } catch (error) {
        reject(error);
      }
    });
  }
}

export class ExtendedUtxo {
  private _utxo!: UTXO;

  private _outpoint!: string;

  private _inscriptions!: InscriptionContext[];

  constructor(utxo: UTXO, inscriptions: InscriptionId[], network: NetworkType) {
    this._utxo = utxo;
    this._outpoint = getOutpointFromUtxo(utxo);
    this._inscriptions = inscriptions.map((inscriptionId) => new InscriptionContext(inscriptionId, network));
  }

  get outpoint(): string {
    return this._outpoint;
  }

  get utxo(): UTXO {
    return this._utxo;
  }

  get inscriptions(): InscriptionContext[] {
    return [...this._inscriptions];
  }

  get hasInscriptions(): boolean {
    return this._inscriptions.length > 0;
  }
}

export abstract class AddressContext {
  protected _type!: SupportedAddressType;

  protected _address!: string;

  protected _publicKey!: string;

  protected _network!: NetworkType;

  private _utxos?: ExtendedUtxo[];

  protected _seedVault!: SeedVault;

  protected _accountIndex!: bigint;

  constructor(
    type: SupportedAddressType,
    address: string,
    publicKey: string,
    network: NetworkType,
    accountIndex: bigint,
    seedVault: SeedVault,
  ) {
    this._type = type;
    this._address = address;
    this._publicKey = publicKey;
    this._network = network;
    this._seedVault = seedVault;
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

      const utxoContexts: ExtendedUtxo[] = [];

      // TODO: Enable testnet once inscriptions available
      // TODO: Use UTXO cache
      const populateUtxoOrdinalIds = async (utxo: UTXO): Promise<void> => {
        const ordinalIds: InscriptionId[] = this._network === 'Testnet' ? [] : await getOrdinalIdsFromUtxo(utxo);

        utxoContexts.push(new ExtendedUtxo(utxo, ordinalIds, this._network));
      };

      await processPromisesBatch(utxos, 20, populateUtxoOrdinalIds);

      this._utxos = utxoContexts;
    }

    return [...this._utxos];
  }

  async getNonOrdinalUtxos(): Promise<ExtendedUtxo[]> {
    const utxos = await this.getUtxos();

    return utxos.filter((utxo) => !utxo.hasInscriptions);
  }

  async getOrdinalUtxos(): Promise<ExtendedUtxo[]> {
    const utxos = await this.getUtxos();

    return utxos.filter((utxo) => utxo.hasInscriptions);
  }

  async getUtxo(outpoint: string): Promise<ExtendedUtxo | undefined> {
    const utxos = await this.getUtxos();

    return utxos.find((utxo) => utxo.outpoint === outpoint);
  }

  abstract addInput(transaction: btc.Transaction, utxo: ExtendedUtxo, options?: CompilationOptions): void;
  abstract signInput(transaction: btc.Transaction, index: number): Promise<void>;
}

class P2shAddressContext extends AddressContext {
  private _p2sh!: ReturnType<typeof btc.p2sh>;

  constructor(address: string, publicKey: string, network: NetworkType, accountIndex: bigint, seedVault: SeedVault) {
    super('p2sh', address, publicKey, network, accountIndex, seedVault);

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
    const privateKey = await getBtcPrivateKey({
      seedPhrase,
      index: this._accountIndex,
      network: this._network,
    });
    transaction.signIdx(hex.decode(privateKey), index);
  }
}

class P2wpkhAddressContext extends AddressContext {
  private _p2wpkh!: ReturnType<typeof btc.p2wpkh>;

  constructor(address: string, publicKey: string, network: NetworkType, accountIndex: bigint, seedVault: SeedVault) {
    super('p2wpkh', address, publicKey, network, accountIndex, seedVault);

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
    const privateKey = await getBtcPrivateKey({
      seedPhrase,
      index: this._accountIndex,
      network: this._network,
    });
    transaction.signIdx(hex.decode(privateKey), index);
  }
}

class P2trAddressContext extends AddressContext {
  private _p2tr!: ReturnType<typeof btc.p2tr>;

  constructor(address: string, publicKey: string, network: NetworkType, accountIndex: bigint, seedVault: SeedVault) {
    super('p2tr', address, publicKey, network, accountIndex, seedVault);

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
}

const createAddressContext = (
  address: string,
  publicKey: string,
  network: NetworkType,
  accountIndex: bigint,
  seedVault: SeedVault,
): AddressContext => {
  const { type } = getAddressInfo(address);

  if (type === AddressType.p2sh) {
    return new P2shAddressContext(address, publicKey, network, accountIndex, seedVault);
  } else if (type === AddressType.p2wpkh) {
    return new P2wpkhAddressContext(address, publicKey, network, accountIndex, seedVault);
  } else if (type === AddressType.p2tr) {
    return new P2trAddressContext(address, publicKey, network, accountIndex, seedVault);
  } else {
    throw new Error('Unsupported payment address type');
  }
};

export class TransactionContext {
  private _paymentAddress!: AddressContext;

  private _ordinalsAddress!: AddressContext;

  private _network!: NetworkType;

  constructor(wallet: WalletContext, seedVault: SeedVault, network: NetworkType, accountIndex: bigint) {
    this._paymentAddress = createAddressContext(
      wallet.btcAddress,
      wallet.btcPublicKey,
      network,
      accountIndex,
      seedVault,
    );
    this._ordinalsAddress =
      wallet.btcAddress === wallet.ordinalsAddress
        ? this._paymentAddress
        : createAddressContext(wallet.ordinalsAddress, wallet.ordinalsPublicKey, network, accountIndex, seedVault);

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
