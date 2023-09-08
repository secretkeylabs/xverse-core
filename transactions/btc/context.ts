import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import OrdinalsProvider from '../../api/ordinals/provider';
import type { Inscription, NetworkType, UTXO } from '../../types';
import { BaseWallet } from '../../types/wallet';

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

  get type(): SupportedAddressType {
    return this._type;
  }

  get address(): string {
    return this._address;
  }

  constructor(type: SupportedAddressType, address: string, publicKey: string, network: NetworkType) {
    this._type = type;
    this._address = address;
    this._publicKey = publicKey;
    this._network = network;
  }

  async getUtxos(): Promise<ExtendedUtxo[]> {
    if (!this._utxos) {
      const [utxos, ordinals] = await Promise.all([
        esploraApi[this._network].getUnspentUtxos(this._address),
        ordinalsApi[this._network].getAllInscriptions(this._address),
      ]);

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
}

class P2shAddressContext extends AddressContext {
  private _p2sh!: ReturnType<typeof btc.p2sh>;

  constructor(address: string, publicKey: string, network: NetworkType) {
    super('p2sh', address, publicKey, network);

    const publicKeyBuff = hex.decode(publicKey);

    const p2wpkh = btc.p2wpkh(publicKeyBuff, btc.NETWORK);

    this._p2sh = btc.p2sh(p2wpkh, btc.NETWORK);
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
}

class P2trAddressContext extends AddressContext {
  private _p2tr!: ReturnType<typeof btc.p2tr>;

  constructor(address: string, publicKey: string, network: NetworkType) {
    super('p2tr', address, publicKey, network);

    const publicKeyBuff = hex.decode(publicKey);

    this._p2tr = btc.p2tr(publicKeyBuff, undefined, btc.NETWORK);
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

  constructor(wallet: BaseWallet, network: NetworkType) {
    this._paymentAddress = new P2shAddressContext(wallet.btcAddress, wallet.btcPublicKey, network);
    this._ordinalsAddress = new P2trAddressContext(wallet.ordinalsAddress, wallet.ordinalsPublicKey, network);
    this._network = network;
  }
}
