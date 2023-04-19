import { UTXO } from "../../types/api/esplora";

export const utxos: Array<UTXO> = [
  {
    txid: '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 780443,
      block_time: 1677048365,
      block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
    },
    value: 6000,
  },
  {
    txid: '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 779082,
      block_hash: '0000000000000000000297702acb257d74e0751e5369200a54274c34418ff161',
      block_time: 1677826165,
    },
    value: 7780,
  },
  {
    txid: 'b048fc332d852d8258a45f5a8b16a346f03a8f5d45b9e94498a5a7db624e01a1',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 779256,
      block_hash: '000000000000000000023c27c9b0ac4e7bfb3b368cc4574c0d45b3712eb7a441',
      block_time: 1677922829,
    },
    value: 9445,
  },
];
