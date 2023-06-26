import { describe, expect, it } from 'vitest';

import { getBtcPrivateKey, getBtcTaprootPrivateKey } from '../../wallet';

describe('getBtcPrivateKey', () => {
  const seedPhrase = 'your seed phrase';
  const index = 0n;
  const network = 'Mainnet';

  it('should generate BTC private key for mainnet', async () => {
    const privateKey = await getBtcPrivateKey({ seedPhrase, index, network });
    expect(privateKey).toEqual('282e3db244568bf547b092f353d8ec3ead3fc094771d4aed1650cbdf36eff549');
  });

  it('should generate BTC private key for testnet', async () => {
    const testnetNetwork = 'Testnet';
    const privateKey = await getBtcPrivateKey({ seedPhrase, index, network: testnetNetwork });
    expect(privateKey).toEqual('c3f625f0492e5567852333a343d5b641c07a29ed5d929cbb2181520a4e34bf4c');
  });
});

describe('getBtcTaprootPrivateKey', () => {
  const seedPhrase = 'your seed phrase';
  const index = 0n;
  const network = 'Mainnet';

  it('should generate BTC Taproot private key for mainnet', async () => {
    const privateKey = await getBtcTaprootPrivateKey({ seedPhrase, index, network });
    expect(privateKey).toEqual('c5ab7a8f8553755f0f7e1b4ebb477524c5730b89f6bf98699fbce2a373ce7288');
  });

  it('should generate BTC Taproot private key for testnet', async () => {
    const testnetNetwork = 'Testnet';
    const privateKey = await getBtcTaprootPrivateKey({
      seedPhrase,
      index,
      network: testnetNetwork,
    });
    expect(privateKey).toEqual('94a796acf401f40a6d99cc7306cd68ffca122fedf34bf237bc8476d1d3eac02a');
  });
});
