import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChainID } from '@stacks/transactions';

import { getStxAddressKeyChain } from '../../wallet';

describe('getStxAddressKeyChain', () => {
  const mnemonic = 'a test mnemonic';
  const chainID = ChainID.Mainnet;
  const accountIndex = 0;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should derive the Stacks address keychain', async () => {
    const result = await getStxAddressKeyChain(mnemonic, chainID, accountIndex);

    expect(result).toEqual({
      childKey: expect.any(Object),
      address: 'SP35BSZZ7AAG53FASGBHSMYAMZNZWA3ZGS49T5XMZ',
      privateKey: '814548f359be3d7dad949bb13a5bd6c074ceb8f67d5b974db60bfbff41533af501',
    });
  });
});
