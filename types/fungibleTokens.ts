export interface BaseToken {
  name: string;
  ticker?: string;
  image?: string;
}

export type FungibleTokenProtocol = 'stacks' | 'brc-20' | 'runes';

export type FungibleToken = BaseToken & {
  balance: string;
  total_sent: string;
  total_received: string;
  principal: string;
  assetName: string;
  decimals?: number;
  /**
   * @deprecated - use FungibleTokenStates instead
   */
  visible?: boolean;
  supported?: boolean;
  tokenFiatRate?: number | null;
  runeSymbol?: string | null;
  runeInscriptionId?: string | null;
  protocol?: FungibleTokenProtocol;
};

export type FungibleTokenStates = {
  isSpam: boolean;
  isEnabled: boolean;
  showToggle: boolean;
};

export type FungibleTokenWithStates = FungibleToken & FungibleTokenStates;
