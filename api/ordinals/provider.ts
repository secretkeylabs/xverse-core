import axios, { AxiosInstance } from 'axios';
import { XORD_URL } from '../../constant';
import { Inscription, InscriptionsList } from '../../types/api/ordinals';
import { NetworkType } from '../../types/network';
import { getXClientVersion } from '../../utils/xClientVersion';

export interface OrdinalsApiProviderOptions {
  network: NetworkType;
}

export class OrdinalsApi {
  private xordClient!: AxiosInstance;

  constructor(options: OrdinalsApiProviderOptions) {
    const { network } = options;

    this.xordClient = axios.create({
      baseURL: `${XORD_URL(network)}/v1`,
      headers: {
        'X-Client-Version': getXClientVersion() || undefined,
      },
    });
  }

  async getInscriptions(address: string, offset: number, limit: number): Promise<InscriptionsList> {
    const params = {
      address,
      offset,
      limit,
    };

    const resp = await this.xordClient.get<InscriptionsList>('inscriptions', { params });

    return resp.data;
  }

  async getAllInscriptions(address: string): Promise<Inscription[]> {
    const allInscriptions: Inscription[] = [];

    let offset = 0;
    let limit = 60;

    let inscriptions: InscriptionsList = await this.getInscriptions(address, offset, limit);
    limit = inscriptions.limit;

    while (inscriptions.results.length > 0) {
      allInscriptions.push(...inscriptions.results);
      offset += limit;
      inscriptions = await this.getInscriptions(address, offset, limit);
    }

    return allInscriptions;
  }

  async getInscription(inscriptionId: string): Promise<Inscription> {
    const resp = await this.xordClient.get<Inscription>(`inscriptions/${inscriptionId}`);
    return resp.data;
  }
}
