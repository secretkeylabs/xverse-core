import { AccountType } from './account';

export enum AnalyticsEvents {
  OptOut = 'Opt Out',
  CreateNewWallet = 'Create new wallet',
  RestoreWallet = 'Restore wallet',
  ClickApp = 'click_app',
  PageViewed = 'page_viewed',
  AppConnected = 'app_connected',
  TransactionConfirmed = 'transaction_confirmed',
  PSBTSigningRequestReceived = 'psbt_signing_request_received',
  MessageSigningRequestReceived = 'message_signing_request_received',
  TransactionSigningRequestReceived = 'transaction_signing_request_received',
}

type CommonProps = {
  wallet_type: AccountType;
};

export type AnalyticsEventProperties = {
  [AnalyticsEvents.PageViewed]: {
    path: string;
    tab?: string;
  } & CommonProps;
  [AnalyticsEvents.AppConnected]: {
    requestedAddress: string[];
  } & CommonProps;
  [AnalyticsEvents.TransactionConfirmed]: {
    protocol: 'brc20' | 'sip10' | 'bitcoin' | 'stacks' | 'runes' | 'ordinals' | 'rare-sats' | 'stacks-nfts';
    action: 'inscribe' | 'transfer' | 'sign-message' | 'sign-psbt' | 'sign-batch-psbt';
    repeat?: true;
    batch?: true;
  } & CommonProps;
  [AnalyticsEvents.PSBTSigningRequestReceived]: {
    batch?: true;
  } & CommonProps;
  [AnalyticsEvents.MessageSigningRequestReceived]: {
    protocol: 'bitcoin' | 'stacks';
    structured?: true;
  } & CommonProps;
  [AnalyticsEvents.TransactionSigningRequestReceived]: {
    protocol: 'stacks';
    action: 'token_transfer' | 'contract_call' | 'smart_contract' | 'transfer';
  } & CommonProps;
};
