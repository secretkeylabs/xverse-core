import { Inscription, InscriptionsList } from '../../types/api/ordinals';


export interface OrdinalsApiProvider {
  /**
   * Get the inscriptions of an account given its addresses.
   * @param {string} address
   * @param {number} offset
   * @param {number} limit
   * @return {Promise<InscriptionsList>}
   */
  getInscriptions(address: string, offset: number, limit: number): Promise<InscriptionsList>;
  /**
   * Get The details a given inscription
   * @param {string} inscriptionId
   * @returns {Promise<Inscription>}
   */
  getInscription(inscriptionId: string): Promise<Inscription>;
}
