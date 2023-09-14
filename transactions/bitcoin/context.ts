import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';

import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import OrdinalsProvider from '../../api/ordinals/provider';
import type { Inscription, NetworkType, UTXO } from '../../types';
import { BaseWallet } from '../../types/wallet';
import { getBtcPrivateKey, getBtcTaprootPrivateKey } from '../../wallet';

import { CompilationOptions, SupportedAddressType } from './types';
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

export class ExtendedUtxo {
  private _utxo!: UTXO;

  private _outpoint!: string;

  private _inscriptions!: Inscription[];

  get outpoint(): string {
    return this._outpoint;
  }

  get utxo(): UTXO {
    return this._utxo;
  }

  get inscriptions(): Inscription[] {
    return [...this._inscriptions];
  }

  get hasInscriptions(): boolean {
    return this._inscriptions.length > 0;
  }

  constructor(utxo: UTXO, inscriptions: Inscription[]) {
    this._utxo = utxo;
    this._outpoint = getOutpointFromUtxo(utxo);
    this._inscriptions = inscriptions;
  }
}

export abstract class AddressContext {
  protected _type!: SupportedAddressType;

  protected _address!: string;

  protected _publicKey!: string;

  protected _network!: NetworkType;

  private _utxos?: ExtendedUtxo[];

  // TODO: Remove when we have seed vault
  protected _seedPhrase!: string;

  protected _accountIndex!: bigint;

  get type(): SupportedAddressType {
    return this._type;
  }

  get address(): string {
    return this._address;
  }

  constructor(
    type: SupportedAddressType,
    address: string,
    publicKey: string,
    network: NetworkType,
    seedPhrase: string,
    accountIndex: bigint,
  ) {
    this._type = type;
    this._address = address;
    this._publicKey = publicKey;
    this._network = network;
    this._seedPhrase = seedPhrase;
    this._accountIndex = accountIndex;
  }

  async getUtxos(): Promise<ExtendedUtxo[]> {
    if (!this._utxos) {
      const utxos = await esploraApi[this._network].getUnspentUtxos(this._address);
      // TODO: Enable testnet once inscriptions available
      const ordinals: Inscription[] =
        this._network === 'Testnet' ? [] : await ordinalsApi[this._network].getAllInscriptions(this._address);

      const ordinalMap = ordinals.reduce(
        (map, ordinal) => ({
          ...map,
          [ordinal.output]: [...(map[ordinal.output] || []), ordinal],
        }),
        {} as Record<string, Inscription[]>,
      );

      this._utxos = utxos.map((utxo) => {
        return new ExtendedUtxo(utxo, ordinalMap[utxo.txid] || []);
      });
    }

    return [...this._utxos];
  }

  async getNonOrdinalUtxos(): Promise<ExtendedUtxo[]> {
    const utxos = await this.getUtxos();

    return utxos.filter((utxo) => !utxo.hasInscriptions);
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

  constructor(address: string, publicKey: string, network: NetworkType, seedPhrase: string, accountIndex: bigint) {
    super('p2sh', address, publicKey, network, seedPhrase, accountIndex);

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
    // TODO: seed vault
    const privateKey = await getBtcPrivateKey({
      seedPhrase: this._seedPhrase,
      index: this._accountIndex,
      network: this._network,
    });
    transaction.signIdx(hex.decode(privateKey), index);
  }
}

class P2wpkhAddressContext extends AddressContext {
  private _p2wpkh!: ReturnType<typeof btc.p2wpkh>;

  constructor(address: string, publicKey: string, network: NetworkType, seedPhrase: string, accountIndex: bigint) {
    super('p2wpkh', address, publicKey, network, seedPhrase, accountIndex);

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
    // TODO: seed vault
    const privateKey = await getBtcPrivateKey({
      seedPhrase: this._seedPhrase,
      index: this._accountIndex,
      network: this._network,
    });
    transaction.signIdx(hex.decode(privateKey), index);
  }
}

class P2trAddressContext extends AddressContext {
  private _p2tr!: ReturnType<typeof btc.p2tr>;

  constructor(address: string, publicKey: string, network: NetworkType, seedPhrase: string, accountIndex: bigint) {
    super('p2tr', address, publicKey, network, seedPhrase, accountIndex);

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
    // TODO: seed vault
    const privateKey = await getBtcTaprootPrivateKey({
      seedPhrase: this._seedPhrase,
      index: this._accountIndex,
      network: this._network,
    });
    transaction.signIdx(hex.decode(privateKey), index);
  }
}

export class TransactionContext {
  private _addresses!: AddressContext[];

  private _changeAddress!: string;

  private _network!: NetworkType;

  get changeAddress(): string {
    return this._changeAddress;
  }

  get network(): NetworkType {
    return this._network;
  }

  constructor(wallet: BaseWallet, network: NetworkType, accountIndex: bigint, changeAddress: string) {
    this._addresses = [];
    this._network = network;
    this._changeAddress = changeAddress;

    // TODO: update the arg type for this instead of calculating it here. Maybe once we have seed vault.
    const addressData = [
      {
        address: wallet.btcAddress,
        publicKey: wallet.btcPublicKey,
      },
      {
        address: wallet.ordinalsAddress,
        publicKey: wallet.ordinalsPublicKey,
      },
    ];

    for (const addressItem of addressData) {
      const { type } = getAddressInfo(addressItem.address);

      if (type === AddressType.p2sh) {
        this._addresses.push(
          new P2shAddressContext(addressItem.address, addressItem.publicKey, network, wallet.seedPhrase, accountIndex),
        );
      } else if (type === AddressType.p2wpkh) {
        this._addresses.push(
          new P2wpkhAddressContext(
            addressItem.address,
            addressItem.publicKey,
            network,
            wallet.seedPhrase,
            accountIndex,
          ),
        );
      } else if (type === AddressType.p2tr) {
        this._addresses.push(
          new P2trAddressContext(addressItem.address, addressItem.publicKey, network, wallet.seedPhrase, accountIndex),
        );
      } else {
        throw new Error('Unsupported payment address type');
      }
    }
  }

  getAddressContext(address: string): AddressContext | undefined {
    return this._addresses.find((context) => context.address === address);
  }

  async getUtxo(outpoint: string): Promise<{ extendedUtxo?: ExtendedUtxo; addressContext?: AddressContext }> {
    for (const addressContext of this._addresses) {
      const extendedUtxo = await addressContext.getUtxo(outpoint);

      if (extendedUtxo) {
        return { extendedUtxo, addressContext };
      }
    }

    return {};
  }

  async getSpendableUtxos(): Promise<{ extendedUtxo: ExtendedUtxo; addressContext: AddressContext }[]> {
    const spendableUtxos: { extendedUtxo: ExtendedUtxo; addressContext: AddressContext }[] = [];

    for (const address of this._addresses) {
      const utxos = await address.getNonOrdinalUtxos();

      // TODO: this might be bad since it won't allow you to spend your change until it is confirmed
      // !Note: Having a payments address would make this easier since we can try to spend anything in there and warn
      // !Note: if there inscriptions
      const addressSpendableUtxos = utxos
        .filter((extendedUtxo) => extendedUtxo.utxo.status.confirmed)
        .map((extendedUtxo) => ({ extendedUtxo, addressContext: address }));

      spendableUtxos.push(...addressSpendableUtxos);
    }

    return spendableUtxos;
  }

  addOutputAddress(transaction: btc.Transaction, address: string, amount: bigint): void {
    transaction.addOutputAddress(address, amount, this._network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }
}
