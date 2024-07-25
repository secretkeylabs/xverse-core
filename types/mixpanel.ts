import { AccountType } from './account';

export enum AnalyticsEvents {
  OptOut = 'Opt Out',
  CreateNewWallet = 'Create new wallet',
  RestoreWallet = 'Restore wallet',
  ClickApp = 'click_app',
  AppConnected = 'app_connected',
  TransactionConfirmed = 'transaction_confirmed',
  WalletMigrated = 'wallet_migrated',
  WalletSkippedMigration = 'wallet_skipped_migration',
  InitiateSwapFlow = 'initiate_swap_flow',
  FetchSwapQuote = 'fetch_swap_quote',
  SelectSwapQuote = 'select_swap_quote',
  ConfirmSwap = 'confirm_swap',
  SignSwap = 'sign_swap',
}

type CommonProps = {
  wallet_type: AccountType;
};

type QuoteSwapProps = {
  provider: string;
  from: string;
  to: string;
};

type QuoteSwapAmountProps = QuoteSwapProps & { fromAmount: string; toAmount: string };

export type AnalyticsEventProperties = {
  [AnalyticsEvents.ClickApp]: {
    link: string;
    source: string;
    title?: string;
    section?: string;
  };
  [AnalyticsEvents.AppConnected]: {
    requestedAddress: string[];
  } & CommonProps;
  [AnalyticsEvents.TransactionConfirmed]: {
    protocol: 'brc20' | 'sip10' | 'bitcoin' | 'stacks' | 'runes' | 'ordinals' | 'rare-sats' | 'stacks-nfts';
    action: 'inscribe' | 'transfer' | 'sign-message' | 'sign-psbt' | 'sign-batch-psbt';
    repeat?: number;
    batch?: number;
  } & CommonProps;
  [AnalyticsEvents.InitiateSwapFlow]: {
    token?: string;
  };
  [AnalyticsEvents.FetchSwapQuote]: {
    from: string;
    to: string;
  };
  [AnalyticsEvents.SelectSwapQuote]: QuoteSwapAmountProps;
  [AnalyticsEvents.ConfirmSwap]: QuoteSwapAmountProps;
  [AnalyticsEvents.SignSwap]: QuoteSwapAmountProps;
};
