import { describe, expect, it } from 'vitest';
import { getFungibleTokenStates } from '../fungibleTokens';
import { type FungibleToken } from '../types';

const sip10Token: FungibleToken = {
  assetName: 'odin-tkn',
  balance: '0',
  decimals: 6,
  image: 'https://SP2X2Z28NXZVJFCJPBR9Q3NBVYBK3GPX8PXA3R83C.odin-tkn/1-thumb.png',
  name: 'Odin',
  principal: 'SP2X2Z28NXZVJFCJPBR9Q3NBVYBK3GPX8PXA3R83C.odin-tkn',
  protocol: 'stacks',
  ticker: 'ODIN',
  total_received: '',
  total_sent: '',
};

const brc20Token: FungibleToken = {
  name: 'ORDI',
  principal: 'ORDI',
  balance: '0',
  total_sent: '',
  total_received: '',
  assetName: 'ORDI',
  ticker: 'ORDI',
  protocol: 'brc-20',
};

const runesToken: FungibleToken = {
  assetName: 'DOG•GO•TO•THE•MOON',
  balance: '3142748244',
  decimals: 5,
  name: 'DOG•GO•TO•THE•MOON',
  principal: '840000:3',
  protocol: 'runes',
  runeInscriptionId: 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375i0',
  runeSymbol: '🐕',
  ticker: '',
  tokenFiatRate: 0.00256291,
  total_received: '',
  total_sent: '',
};

describe('getFungibleTokenStates', () => {
  [
    {
      name: 'should default a supported sip10 token with balance to enabled',
      inputs: {
        fungibleToken: {
          ...sip10Token,
          supported: true,
          balance: '100',
        },
        manageTokens: {},
        spamTokens: [],
        showSpamTokens: false,
      },
      expected: {
        isSpam: false,
        isEnabled: true,
        showToggle: true,
        isTopToken: false,
      },
    },
    {
      name: 'should default an unsupported sip10 token with balance to disabled - scam tokens',
      inputs: {
        fungibleToken: {
          ...sip10Token,
          supported: false,
          balance: '100',
        },
        manageTokens: {},
        spamTokens: [],
        showSpamTokens: false,
      },
      expected: {
        isSpam: false,
        isEnabled: false,
        showToggle: true,
        isTopToken: false,
      },
    },
    {
      name: 'should disable and hide any token with balance if in spam tokens',
      inputs: {
        fungibleToken: {
          ...sip10Token,
          supported: true,
          balance: '100',
        },
        manageTokens: {},
        spamTokens: [sip10Token.principal],
        showSpamTokens: false,
      },
      expected: {
        isSpam: true,
        isEnabled: false,
        showToggle: false,
        isTopToken: false,
      },
    },
    {
      name: 'should show toggle if token has balance, in spam tokens, but user pressed show spam tokens',
      inputs: {
        fungibleToken: {
          ...sip10Token,
          supported: false,
          balance: '100',
        },
        manageTokens: {},
        spamTokens: [sip10Token.principal],
        showSpamTokens: true,
      },
      expected: {
        isSpam: false,
        isEnabled: false,
        showToggle: true,
        isTopToken: false,
      },
    },
    {
      name: 'should default any supported brc20 token with balance to enabled, if not in spam tokens',
      inputs: {
        fungibleToken: {
          ...brc20Token,
          balance: '100',
          supported: true,
        },
        manageTokens: {},
        spamTokens: [],
        showSpamTokens: false,
      },
      expected: {
        isSpam: false,
        isEnabled: true,
        showToggle: true,
        isTopToken: false,
      },
    },
    {
      name: 'should default any supported runes token with balance to enabled, if not in spam tokens',
      inputs: {
        fungibleToken: {
          ...runesToken,
          balance: '100',
          supported: true,
        },
        manageTokens: {},
        spamTokens: [],
        showSpamTokens: false,
      },
      expected: {
        isSpam: false,
        isEnabled: true,
        showToggle: true,
        isTopToken: false,
      },
    },
    {
      name: 'should show toggle if token is in spam tokens but user enabled it',
      inputs: {
        fungibleToken: {
          ...runesToken,
          balance: '100',
        },
        manageTokens: { [runesToken.principal]: true },
        spamTokens: [runesToken.principal],
        showSpamTokens: false,
      },
      expected: {
        isSpam: true,
        isEnabled: true,
        showToggle: true,
        isTopToken: false,
      },
    },
    {
      name: 'should default to enabled if token is promoted and doesnt have settings on it',
      inputs: {
        fungibleToken: {
          ...runesToken,
          balance: '0',
          isTopToken: true,
        },
        manageTokens: {},
        spamTokens: [],
        showSpamTokens: false,
      },
      expected: {
        isSpam: false,
        isEnabled: true,
        showToggle: true,
        isTopToken: true,
      },
    },
  ].forEach(({ name, inputs, expected }) => {
    it(name, () => {
      expect(getFungibleTokenStates(inputs)).toEqual(expected);
    });
  });
});
