import BigNumber from 'bignumber.js';
import { UtxoCache } from '../../api';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UTXO, UtxoOrdinalBundle } from '../../types';
import { getOutpointFromUtxo } from './utils';

export class ExtendedUtxo {
  private _utxo!: UTXO;

  private _address!: string;

  private _outpoint!: string;

  private _hex!: string;

  private _utxoCache!: UtxoCache;

  private _esploraApiProvider!: EsploraProvider;

  private _isExternal!: boolean;

  private _bundleData?: UtxoOrdinalBundle;

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

  get hex(): Promise<string | undefined> {
    if (this._hex) {
      return Promise.resolve(this._hex);
    }

    return new Promise(async (resolve, reject) => {
      try {
        const hex = await this._esploraApiProvider.getTransactionHex(this._utxo.txid);

        if (hex) {
          this._hex = hex;
        }

        resolve(hex);
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

  async getBundleData(): Promise<UtxoOrdinalBundle | undefined> {
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

  /** Returns undefined if UTXO has not yet been indexed */
  async hasRunes(): Promise<boolean | undefined> {
    const bundleData = await this.getBundleData();

    const hasRunes = bundleData?.runes && bundleData.runes.some((rune) => rune[1].amount.gt(0));

    return hasRunes;
  }

  async getRuneBalance(runeName: string): Promise<BigNumber | undefined> {
    const bundleData = await this.getBundleData();

    if (!bundleData) {
      // utxo hasn't been indexed yet
      return undefined;
    }

    const runeEntry = bundleData.runes?.find((rune) => rune[0] === runeName.toUpperCase());
    const runeBalance = BigNumber(runeEntry?.[1].amount ?? 0);

    return runeBalance;
  }

  async getRuneBalances(): Promise<{ [runeName: string]: BigNumber } | undefined> {
    const bundleData = await this.getBundleData();

    if (!bundleData) {
      // utxo hasn't been indexed yet
      return undefined;
    }

    const runeEntry = bundleData.runes?.reduce((acc, rune) => {
      acc[rune[0]] = rune[1].amount;
      return acc;
    }, {} as { [runeName: string]: BigNumber });

    return runeEntry;
  }
}

export class ExtendedDummyUtxo {
  private _utxo!: UTXO;

  private _address!: string;

  private _outpoint!: string;

  get address(): string {
    return this._address;
  }

  constructor(utxo: UTXO, address: string) {
    this._utxo = utxo;
    this._address = address;
    this._outpoint = getOutpointFromUtxo(utxo);
  }

  get outpoint(): string {
    return this._outpoint;
  }

  get utxo(): UTXO {
    return this._utxo;
  }

  async getUnconfirmedUtxoFeeData(): Promise<{ totalVsize: number; totalFee: number }> {
    return {
      totalVsize: 0,
      totalFee: 0,
    };
  }

  async getBundleData(): Promise<UtxoOrdinalBundle | undefined> {
    return undefined;
  }

  async isEmbellished(): Promise<boolean | undefined> {
    return undefined;
  }

  async hasRunes(): Promise<boolean | undefined> {
    return undefined;
  }

  async getRuneBalance(_: string): Promise<BigNumber | undefined> {
    return undefined;
  }

  async getRuneBalances(): Promise<{ [runeName: string]: BigNumber } | undefined> {
    return undefined;
  }
}
