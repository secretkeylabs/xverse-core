/* eslint-disable max-len */
import * as bip32 from '@scure/bip32';
import { describe, expect, it } from 'vitest';
import { getStxAddressKeyChain } from '../../account';
import { StacksMainnet, StacksTestnet } from '../../types';

describe('getStxAddressKeyChain', () => {
  const rootNode = bip32.HDKey.fromMasterSeed(
    Buffer.from(
      '8cf43d9c7eb3fdceb654c998b22264c31cff25040ca795d514d862c64272c19c96d560d23d94b7dbd1bea02a5f933bf822d3bef9d62c03d89b1e51d0312417ca',
      'hex',
    ),
  );

  it('should derive Stacks address chain for mainnet', () => {
    const index = 0n;

    const result = getStxAddressKeyChain(StacksMainnet, rootNode, 'index', index);

    expect(result.address).toEqual('SP2Z0K8AAXAWWGXRZN1BGPHY8QXHNGYV7D760NQWV');
    expect(result.privateKey).toEqual('b10393c8467727944413264495948c9c81229ac5796e910b53ad6b8e7093fbfb01');
  });

  it('should derive Stacks address chain for testnet', () => {
    const index = 0n;

    const result = getStxAddressKeyChain(StacksTestnet, rootNode, 'index', index);

    expect(result.address).toEqual('ST2Z0K8AAXAWWGXRZN1BGPHY8QXHNGYV7D7P5MJY2');
    expect(result.privateKey).toEqual('b10393c8467727944413264495948c9c81229ac5796e910b53ad6b8e7093fbfb01');
  });
});
