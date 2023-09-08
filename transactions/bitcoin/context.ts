import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import OrdinalsProvider from '../../api/ordinals/provider';
import type { Inscription, NetworkType, UTXO } from '../../types';
import { BaseWallet } from '../../types/wallet';
import { getBtcPrivateKey, getBtcTaprootPrivateKey } from '../../wallet';

import { SupportedAddressType } from './types';
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

  abstract addInput(transaction: btc.Transaction, utxo: ExtendedUtxo): void;
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

  addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo): void {
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

  addInput(transaction: btc.Transaction, extendedUtxo: ExtendedUtxo): void {
    const utxo = extendedUtxo.utxo;

    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: this._p2tr.script,
        amount: BigInt(utxo.value),
      },
      tapInternalKey: hex.decode(this._publicKey),
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
  private _paymentAddress!: AddressContext;

  private _ordinalsAddress!: AddressContext;

  private _network!: NetworkType;

  get paymentAddress(): AddressContext {
    return this._paymentAddress;
  }

  get ordinalsAddress(): AddressContext {
    return this._ordinalsAddress;
  }

  constructor(wallet: BaseWallet, network: NetworkType, accountIndex: bigint) {
    this._paymentAddress = new P2shAddressContext(
      wallet.btcAddress,
      wallet.btcPublicKey,
      network,
      wallet.seedPhrase,
      accountIndex,
    );
    this._ordinalsAddress = new P2trAddressContext(
      wallet.ordinalsAddress,
      wallet.ordinalsPublicKey,
      network,
      wallet.seedPhrase,
      accountIndex,
    );
    this._network = network;
  }

  addOutputAddress(transaction: btc.Transaction, address: string, amount: bigint): void {
    transaction.addOutputAddress(address, amount, this._network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);
  }
}
