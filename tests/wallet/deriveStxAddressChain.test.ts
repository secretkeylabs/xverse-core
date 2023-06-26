import { ChainID } from '@stacks/transactions';
import { describe, expect, it } from 'vitest';
import { bip32 } from '../../utils/bip32';
import { ECPair } from '../../utils/ecpair';
import { deriveStxAddressChain } from '../../wallet';
import { ecPairToHexString } from '../../wallet/helper';

describe('Unit tests', () => {
  describe('ecPairToHexString', () => {
    const privateKey = Buffer.from(
      'b10393c8467727944413264495948c9c81229ac5796e910b53ad6b8e7093fbfb',
      'hex'
    );

    it('should convert ECPair to hex string', () => {
      const ecPair = ECPair.fromPrivateKey(privateKey, { compressed: false });
      const result = ecPairToHexString(ecPair);
      expect(result).toEqual('b10393c8467727944413264495948c9c81229ac5796e910b53ad6b8e7093fbfb');
    });

    it('should convert compressed ECPair to hex string ending in "01"', () => {
      const ecPair = ECPair.fromPrivateKey(privateKey, { compressed: true });
      const result = ecPairToHexString(ecPair);
      expect(result).toEqual('b10393c8467727944413264495948c9c81229ac5796e910b53ad6b8e7093fbfb01');
    });
  });

  describe('deriveStxAddressChain', () => {
    const rootNode = bip32.fromSeed(
      Buffer.from(
        '8cf43d9c7eb3fdceb654c998b22264c31cff25040ca795d514d862c64272c19c96d560d23d94b7dbd1bea02a5f933bf822d3bef9d62c03d89b1e51d0312417ca',
        'hex'
      )
    );

    it('should derive Stacks address chain for mainnet', () => {
      const chain = ChainID.Mainnet;
      const index = 0n;

      const result = deriveStxAddressChain(chain, index)(rootNode);

      expect(result.address).toEqual('SP2Z0K8AAXAWWGXRZN1BGPHY8QXHNGYV7D760NQWV');
      expect(result.privateKey).toEqual(
        'b10393c8467727944413264495948c9c81229ac5796e910b53ad6b8e7093fbfb01'
      );
    });

    it('should derive Stacks address chain for testnet', () => {
      const chain = ChainID.Testnet;
      const index = 0n;

      const result = deriveStxAddressChain(chain, index)(rootNode);

      expect(result.address).toEqual('ST2Z0K8AAXAWWGXRZN1BGPHY8QXHNGYV7D7P5MJY2');
      expect(result.privateKey).toEqual(
        'b10393c8467727944413264495948c9c81229ac5796e910b53ad6b8e7093fbfb01'
      );
    });
  });
});
