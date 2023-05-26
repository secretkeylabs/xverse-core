import { makeAuthResponse } from '@stacks/wallet-sdk';
import { describe, expect, it, vi } from 'vitest';

import { createAuthResponse } from '../../connect';
import { testSeed } from '../mocks/restore.mock';

vi.mock('@stacks/wallet-sdk');

describe('createAuthResponse', () => {
  it('should create an auth response', async () => {
    const mockedMakeAuthResponse = vi.mocked(makeAuthResponse);
    const mockResponse = 'auth_response';
    mockedMakeAuthResponse.mockResolvedValue(mockResponse);

    const authRequest = {
      payload: {
        redirect_uri: 'https://app.dummy.org',
        public_keys: ['public_key'],
        scopes: ['test_scope'],
      },
    };

    const response = await createAuthResponse(testSeed, 0, authRequest);

    expect(response).toEqual(mockResponse);

    expect(mockedMakeAuthResponse).toHaveBeenCalledWith({
      account: {
        appsKey:
          'xprvA1y7VptWdGrgEKGiMJUFFJYadomEi8j895uwk9Z7D1EMF2gzjQCk1dLqdUWAxzZgdVedh9zmd8adisr8FtqiCBZSDWbbmmtBR2KnbwZ9jzd',
        dataPrivateKey: '3637609c5bba9d92acab8a86bb78a8dfdb3a69228c6c6a50ccfbf17c51ec23ed',
        index: 0,
        salt: expect.any(String),
        stxPrivateKey: '3d30deda5e636d2707e8890531ffbfdd12d20a0be6bde1aa9d479609c60cb23201',
      },
      appDomain: 'https://app.dummy.org',
      gaiaHubUrl: 'https://hub.blockstack.org',
      scopes: ['test_scope'],
      transitPublicKey: 'public_key',
    });
  });
});
