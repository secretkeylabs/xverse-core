
import { HIRO_MAINNET_DEFAULT, HIRO_TESTNET_DEFAULT } from '../../constant';
import { NetworkType } from '../../types/network';
import * as ordinalsType from '../../types/api/ordinals';
import { OrdinalsApiProvider } from './types';
import ApiInstance from '../instance';

export interface OrdinalsApiProviderOptions {
  network: NetworkType;
  url?: string;
}

const API_PREFIX = '/ordinals/v1/';

export default class OrdinalsApi extends ApiInstance implements OrdinalsApiProvider {
  _network: NetworkType;

  constructor(options: OrdinalsApiProviderOptions) {
    const { url, network } = options;
    super({
      baseURL:
        `${url}${API_PREFIX}` || network == 'Mainnet'
          ? `${HIRO_MAINNET_DEFAULT}${API_PREFIX}`
          : `${HIRO_TESTNET_DEFAULT}${API_PREFIX}`,
    });
    this._network = network;
  }

  async getInscriptions(address: string, offset: number, limit: number): Promise<ordinalsType.InscriptionsList> {
    const data: ordinalsType.InscriptionsList = await this.httpGet(
      `inscriptions?address=${address}&offset=${offset}&limit=${limit}`
    );
    return data;
  }

  async getInscription(inscriptionId: string): Promise<ordinalsType.Inscription> {
    const inscription: ordinalsType.Inscription = await this.httpGet(`inscriptions/${inscriptionId}`);
    return inscription;
  }
}
