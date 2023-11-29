import BigNumber from 'bignumber.js';
import { RBFProps } from '../../transactions/rbf';
import { BtcTransactionData, UTXO } from '../../types';

/* eslint-disable max-len */
export const rbfTransaction: BtcTransactionData = {
  blockHash: '',
  blockHeight: 0,
  txid: 'eb3ddbc9fb830b4470da0d723958a5819d8239f8bd9e4675d913f93631f3e025',
  total: 383030,
  fees: 33288,
  size: 699,
  weight: 1995,
  confirmed: false,
  inputs: [
    {
      txid: '0ea74611a82a58325b5aa9df6d299c47c7e163fc44cf7ae2e20892fd9d5a5ab2',
      vout: 1,
      prevout: {
        scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
        scriptpubkey_asm:
          'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
        scriptpubkey_type: 'v1_p2tr',
        scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
        value: 600,
      },
      scriptsig: '',
      scriptsig_asm: '',
      is_coinbase: false,
      sequence: 4294967293,
    },
    {
      txid: '0ea74611a82a58325b5aa9df6d299c47c7e163fc44cf7ae2e20892fd9d5a5ab2',
      vout: 0,
      prevout: {
        scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
        scriptpubkey_asm:
          'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
        scriptpubkey_type: 'v1_p2tr',
        scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
        value: 600,
      },
      scriptsig: '',
      scriptsig_asm: '',
      is_coinbase: false,
      sequence: 4294967293,
    },
    {
      txid: '1ce21439d00ab3b88871527a81c9df8f3116aeb82ecd0a08c0f9b91b4efc28c3',
      vout: 1,
      prevout: {
        scriptpubkey: '51201bcb99a624c563811c17f19ddec38c8985f4256b68e2e9bc0a690a91dae30b57',
        scriptpubkey_asm:
          'OP_PUSHNUM_1 OP_PUSHBYTES_32 10661dc1a6c090edf3a7e81698a8bc57b18a2a78b4db878b9afbf630c64b5f8c',
        scriptpubkey_type: 'v1_p2tr',
        scriptpubkey_address: 'bc1pr09enf3yc43cz8qh7xwaasuv3xzlgfttdr3wn0q2dy9frkhrpdtsk05jqq',
        value: 546,
      },
      scriptsig: '',
      scriptsig_asm: '',
      is_coinbase: false,
      sequence: 4294967293,
    },
    {
      txid: '0ea74611a82a58325b5aa9df6d299c47c7e163fc44cf7ae2e20892fd9d5a5ab2',
      vout: 2,
      prevout: {
        scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
        scriptpubkey_asm:
          'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
        scriptpubkey_type: 'v1_p2tr',
        scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
        value: 39965541,
      },
      scriptsig: '',
      scriptsig_asm: '',
      is_coinbase: false,
      sequence: 4294967295,
    },
  ],
  outputs: [
    {
      scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
      scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
      scriptpubkey_type: 'v1_p2tr',
      scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
      value: 1200,
    },
    {
      scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
      scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
      scriptpubkey_type: 'v1_p2tr',
      scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
      value: 546,
    },
    {
      scriptpubkey: '512010661dc1a6c090edf3a7e81698a8bc57b18a2a78b4db878b9afbf630c64b5f8c',
      scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_32 10661dc1a6c090edf3a7e81698a8bc57b18a2a78b4db878b9afbf630c64b5f8c',
      scriptpubkey_type: 'v1_p2tr',
      scriptpubkey_address: 'bc1pzpnpmsdxczgwmua8aqtf329u27cc52nckndc0zu6l0mrp3jtt7xq7fl98j',
      value: 317000,
    },
    {
      scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
      scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
      scriptpubkey_type: 'v1_p2tr',
      scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
      value: 600,
    },
    {
      scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
      scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
      scriptpubkey_type: 'v1_p2tr',
      scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
      value: 600,
    },
    {
      scriptpubkey: 'a91405205028abaa2a0de49be6228e1f31131ea7f2b087',
      scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_32 c8d078e4a73432bb0f5f19ace8578e356b1031a8a68e7905765d8e996a76cc82',
      scriptpubkey_type: 'v1_p2tr',
      scriptpubkey_address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
      value: 39614053,
    },
  ],
  seenTime: new Date('1970-01-01T00:00:00.000Z'),
  incoming: false,
  amount: new BigNumber(349742),
  txType: 'bitcoin',
  txStatus: 'pending',
  isOrdinal: false,
  recipientAddress: 'bc1pzpnpmsdxczgwmua8aqtf329u27cc52nckndc0zu6l0mrp3jtt7xq7fl98j',
};

export const wallet: RBFProps = {
  btcAddress: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
  btcPublicKey: '032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff',
  ordinalsAddress: 'bc1pr09enf3yc43cz8qh7xwaasuv3xzlgfttdr3wn0q2dy9frkhrpdtsk05jqq',
  ordinalsPublicKey: '5b21869d6643175e0530aeec51d265290d036384990ee60bf089b23ff6b9a367',
  seedVault: {
    getSeed: () => 'seed',
  } as any,
  accountId: 0,
  network: 'Mainnet',
  accountType: 'software',
};

export const largeUtxo: UTXO = {
  txid: 'bb01711d83a22efcb10a8f025d17e61a09a53fafb22c4faf831df0cbdf104b40',
  vout: 0,
  status: {
    confirmed: true,
    block_height: 790416,
    block_hash: '0000000000000000000353903f91b9280da1bfa205469d8fee2d9e79af9a1878',
    block_time: 1684480442,
  },
  value: 1000000000,
  address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
};
