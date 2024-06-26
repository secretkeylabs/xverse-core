import { NetworkType } from '../../network';

export type FeatureId = 'RUNES_SUPPORT' | 'SWAPS' | 'RUNES_LISTING';

export type AppFeaturesContext = {
  network: NetworkType;
  paymentAddress: string;
  ordinalsAddress: string;
};

export type AppFeaturesBody = {
  context: Partial<AppFeaturesContext>;
};

export type AppFeaturesResponse = Partial<Record<FeatureId, { enabled: boolean }>>;
