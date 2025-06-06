import * as bip39 from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { getAccountDerivationPath, sendTx } from './utils';
import { encode, num } from 'starknet';
import { grindKey } from '@scure/starknet';

export const run = async () => {
  const seed = await bip39.mnemonicToSeed(
    'action action action action action action action action action action action action',
  );
  const rootNode = HDKey.fromMasterSeed(seed);
  const accountNode = rootNode.derive(getAccountDerivationPath({ accountIndex: 0n }));
  const privateKeyHD = accountNode.privateKey;

  if (!privateKeyHD) throw new Error('Expected `privateKeyHD` to be defined.');

  const privateKey = num.hexToBytes(encode.sanitizeHex(grindKey(privateKeyHD)));

  await sendTx(
    '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    'transfer', // gets converted to 'selector' – a hash of this is what goes on the wire
    // https://www.stark-utils.xyz/converter
    [
      '0x42', // recipient (address is bogus therefore this gets burned)
      // amount is u256 – first 128 bits of the amount (low), then second 128 bits of the amount (high).
      // (quite bizarre backstory; Ethereum uses 256 bits for any balance and to stay compatible, Starknet must too.
      // but the native Starknet data type is felt252 – a bit less than 252 bits. Therefore this quite stupid approach.)
      '1',
      '0',
    ], // burns 1 fri
    privateKey,
  );
};
