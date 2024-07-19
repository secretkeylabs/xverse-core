import { NetworkType } from '../../network';

export enum FeatureId {
  RUNES_SUPPORT = 'RUNES_SUPPORT',
  RUNES_LISTING = 'RUNES_LISTING',
  SWAPS = 'SWAPS',
  PAYPAL = 'PAYPAL',
  CROSS_CHAIN_SWAPS = 'CROSS_CHAIN_SWAPS',
}
export type AppFeaturesContext = {
  network: NetworkType;
  paymentAddress: string;
  ordinalsAddress: string;
};

export type AppFeaturesBody = {
  context: Partial<AppFeaturesContext>;
};

export type AppFeaturesResponse = Partial<Record<FeatureId, { enabled: boolean }>>;
