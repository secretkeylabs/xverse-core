import { NetworkType } from '../../network';

export enum FeatureId {
  RUNES_SUPPORT = 'RUNES_SUPPORT',
  RUNES_LISTING = 'RUNES_LISTING',
  SWAPS = 'SWAPS',
  PAYPAL = 'PAYPAL',
  CROSS_CHAIN_SWAPS = 'CROSS_CHAIN_SWAPS',
  STACKS_SWAPS = 'STACKS_SWAPS',
  PORTFOLIO_TRACKING = 'PORTFOLIO_TRACKING',
  DYNAMIC_MOBILE_ICONS = 'DYNAMIC_MOBILE_ICONS',
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
