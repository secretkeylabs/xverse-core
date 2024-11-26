import BigNumber from 'bignumber.js';
import { type FungibleToken, type FungibleTokenStates, type RuneBalance } from '../types';

export const runeTokenToFungibleToken = (runeBalance: RuneBalance & { isTopToken?: boolean }): FungibleToken => ({
  name: runeBalance.runeName,
  decimals: runeBalance.divisibility,
  principal: runeBalance.id,
  balance: runeBalance.amount.toString(),
  total_sent: '',
  total_received: '',
  assetName: runeBalance.runeName,
  ticker: '',
  runeSymbol: runeBalance.symbol,
  runeInscriptionId: runeBalance.inscriptionId,
  protocol: 'runes',
  supported: true, // all runes are supported
  priceChangePercentage24h: runeBalance.priceChangePercentage24h?.toString(),
  currentPrice: runeBalance.currentPrice?.toString(),
  isTopToken: runeBalance.isTopToken,
});

/**
 * Logic for determining the derived UI state of a fungible token
 *
 * Extend this if any of the business logic changes around when a token shows
 * up in spam, in manage tokens, is included in account balance etc.
 */
export const getFungibleTokenStates = ({
  fungibleToken,
  manageTokens,
  spamTokens,
  showSpamTokens,
}: {
  fungibleToken: FungibleToken;
  manageTokens?: Record<string, boolean | undefined>;
  spamTokens?: string[];
  showSpamTokens?: boolean;
}): FungibleTokenStates => {
  const hasBalance = new BigNumber(fungibleToken.balance).gt(0);
  const isSpam = showSpamTokens ? false : !!spamTokens?.includes(fungibleToken.principal);
  const isUserEnabled = manageTokens?.[fungibleToken.principal]; // true=enabled, false=disabled, undefined=not set
  const isDefaultEnabled = fungibleToken.supported && hasBalance && !isSpam;
  const isTopToken = Boolean(fungibleToken.isTopToken);
  const isEnabled = isUserEnabled || !!(isUserEnabled === undefined && (isDefaultEnabled || isTopToken));
  const showToggle = isEnabled || ((hasBalance || isTopToken) && !isSpam);

  return {
    isSpam,
    isEnabled,
    showToggle,
    isTopToken,
  };
};
