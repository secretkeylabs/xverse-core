import { NetworkType } from '../../../types';

type AddressRegistrationData = {
  pathSuffix: string;
  xPubKey: string;
  signature: string;
  type: 'p2sh' | 'p2wpkh' | 'p2tr';
};

export abstract class BaseAddressRegistrar {
  private isFinalized = false;

  public get IsFinalized(): boolean {
    return this.isFinalized;
  }

  protected set IsFinalized(value: true) {
    this.isFinalized = value;
    Object.freeze(this.registrationData);
  }

  protected registrationData: Record<string, AddressRegistrationData> = {};

  public get RegistrationData(): Record<string, AddressRegistrationData> {
    return this.registrationData;
  }

  protected challenge: string;

  protected network: NetworkType;

  constructor(challenge: string, network: NetworkType) {
    this.network = network;
    this.challenge = challenge;
  }
}
