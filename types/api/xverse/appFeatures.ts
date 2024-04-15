import { NetworkType } from '../../network';

export type FeatureId = 'RUNES_SUPPORT';

export type AppFeaturesContext = {
  network: NetworkType;
  masterPubKey: string;
};

export type AppFeaturesBody = {
  context: Partial<AppFeaturesContext>;
};

export type AppFeaturesResponse = Partial<Record<FeatureId, { enabled: boolean }>>;
