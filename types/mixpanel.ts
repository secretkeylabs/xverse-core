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
  SelectTokenToSwapFrom = 'select_token_to_swap_from',
  SelectTokenToSwapTo = 'select_token_to_swap_to',
  ListRuneInitiated = 'list_rune_initiated',
  ListRuneSigned = 'list_rune_signed',
  SetupWallet = 'setup_wallet',
  BackupWallet = 'backup_wallet',
  BackupWalletLater = 'backup_wallet_later',
  InitiateBuyFlow = 'initiate_buy_flow',
  SelectBuyProvider = 'select_buy_provider',
  InitiateSendFlow = 'initiate_send_flow',
  InitiateReceiveFlow = 'initiate_receive_flow',
  VisitCollectiblesTab = 'visit_collectibles_tab',
  VisitStackingTab = 'visit_stacking_tab',
  VisitExplorePage = 'visit_explore_page',

  // Fiat on-ramp flow events
  ClickBuyButton = 'click_buy_button',
  SelectCryptoToBuy = 'select_crypto_to_buy',
  CurrencySelected = 'currency_selected',
  InputFiatAmount = 'input_fiat_amount',
  ClickQuickAmountButton = 'click_quick_amount_button',
  PaymentMethodSelected = 'payment_method_selected',
  ClickPayWithCryptoTokens = 'click_pay_with_crypto_tokens',
  ClickGetQuotes = 'click_get_quotes',
  ClickQuoteOption = 'click_quote_option',
  OnrampSuccessful = 'onramp_successful',
  OnrampFailure = 'onramp_failure',
}

type CommonProps = {
  wallet_type: AccountType;
};

type WalletBackupType = 'manual' | 'cloud';

type SetupWalletProps = {
  source: 'create' | 'restore';
};

type BackupWalletProps = {
  source?: 'onboarding' | 'settings';
  backupType: WalletBackupType;
};

type RestoreWalletProps = {
  backupType: WalletBackupType;
};

type TokenSelection = {
  principal?: string;
  selectedToken?: string;
};

type BaseSwapEvent = {
  fromTokenUsdValue: string | number;
  to?: string;
  from?: string;
  provider?: string;
  toPrincipal?: string;
  fromPrincipal?: string;
};

interface SwapAmountEvent extends BaseSwapEvent {
  toTokenAmount?: string;
  fromTokenAmount?: string;
}

interface SelectSwapQuoteEvent {
  provider: string;
  from: string;
  to: string;
  fromPrincipal?: string;
  toPrincipal?: string;
}

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
  [AnalyticsEvents.InitiateSwapFlow]: TokenSelection;
  [AnalyticsEvents.FetchSwapQuote]: SwapAmountEvent;
  [AnalyticsEvents.ConfirmSwap]: SwapAmountEvent;
  [AnalyticsEvents.SignSwap]: SwapAmountEvent;
  [AnalyticsEvents.SelectSwapQuote]: SelectSwapQuoteEvent;
  [AnalyticsEvents.SelectTokenToSwapFrom]: TokenSelection;
  [AnalyticsEvents.SelectTokenToSwapTo]: TokenSelection;
  [AnalyticsEvents.SetupWallet]: SetupWalletProps;
  [AnalyticsEvents.BackupWallet]: BackupWalletProps;
  [AnalyticsEvents.RestoreWallet]: RestoreWalletProps;
  [AnalyticsEvents.InitiateBuyFlow]: { source: 'dashboard' | 'token' | 'send_stx' | 'send_btc'; selectedToken: string };
  [AnalyticsEvents.InitiateSendFlow]: {
    source: 'dashboard' | 'token' | 'send_stx' | 'send_btc' | 'send_brc20' | 'send_sip10';
    selectedToken: string;
  };
  [AnalyticsEvents.InitiateReceiveFlow]: {
    source: 'dashboard' | 'token' | 'send_stx' | 'send_btc' | 'collectibles';
    addressType: 'stx' | 'btc_payment' | 'btc_ordinals';
    selectedToken?: string;
  };
  [AnalyticsEvents.SelectBuyProvider]: {
    provider: 'xverse_swaps' | 'moonpay' | 'transak' | 'paypal';
  };
  [AnalyticsEvents.SelectCryptoToBuy]: {
    crypto: string;
  };
  [AnalyticsEvents.CurrencySelected]: {
    currency: string;
  };
  [AnalyticsEvents.InputFiatAmount]: {
    amount: number;
    currency: string;
  };
  [AnalyticsEvents.ClickQuickAmountButton]: {
    amount: number;
  };
  [AnalyticsEvents.PaymentMethodSelected]: {
    method: string;
  };
  [AnalyticsEvents.ClickPayWithCryptoTokens]: {
    token: string;
  };
  [AnalyticsEvents.ClickQuoteOption]: {
    provider: string;
    tags: string[];
  };
};
