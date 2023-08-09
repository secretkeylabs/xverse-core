export const utxo10k = {
  txid: 'bb01711d83a22efcb10a8f025d17e61a09a53fafb22c4faf831df0cbdf104b40',
  vout: 0,
  status: {
    confirmed: true,
    block_height: 790416,
    block_hash: '0000000000000000000353903f91b9280da1bfa205469d8fee2d9e79af9a1878',
    block_time: 1684480442,
  },
  value: 10000,
  address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
};

export const utxo3k = {
  txid: '758debef5a1930c93ea0a99d3110c78db0a7d26dc5765ae33ab160ebc68f1b39',
  vout: 0,
  status: {
    confirmed: true,
    block_height: 786775,
    block_hash: '00000000000000000002104d6d7828d2fbd215e67c443c5da59a311f1ff99321',
    block_time: 1682311497,
  },
  value: 3000,
  address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
};

export const utxo384k = {
  txid: '61afc3bed964c4809fd8461c51331993776254752d03f8f51431f27bb4b4a6dc',
  vout: 0,
  status: {
    confirmed: true,
    block_height: 795007,
    block_hash: '000000000000000000002ed5bfd475a681dbbfb330b8fdcf1a85e3228ab0370b',
    block_time: 1687154049,
  },
  value: 384000,
  address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
};

export const utxo792k = {
  txid: '0c3d764f62b815803a83c4b6df499d4cd02cebe95bb7f1921f241d1626d40b54',
  vout: 2,
  status: {
    confirmed: true,
    block_height: 794726,
    block_hash: '00000000000000000002a7b8cf55cf0d82a503ce64f5596ac82df4e7788cd50a',
    block_time: 1686984560,
  },
  value: 792000,
  address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
};

export const utxos = [
  utxo10k,
  utxo3k,
  utxo384k,
  utxo792k,
  // below are dust UTXOs which should never be selected
  {
    txid: 'c0979647f08b98dd5e863459bd3b66e7545a87d6dfa377f6437c668fc718861c',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 786680,
      block_hash: '00000000000000000000f51440ad69222f84657ffcd454804319af24d6cdc5e3',
      block_time: 1682256800,
    },
    value: 546,
    address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
  },
  {
    txid: 'b11f8946882d156fa0a4c495209bdcc8bbe9aa8aae06ba5954c6f1502eb8b11d',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 786583,
      block_hash: '000000000000000000024256567d65bc178eaf22d78938ad5a762602fd003281',
      block_time: 1682195537,
    },
    value: 546,
    address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
  },
  {
    txid: 'aed7a41d0e6f404aa91db1b5bff1b1a75830324c62b28914a30ca8baf895bc84',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 786814,
      block_hash: '00000000000000000001ba2c991ae6a5107bbc1aade24d9f3724aac929491e2e',
      block_time: 1682339651,
    },
    value: 546,
    address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
  },
  {
    txid: '6f317fabea61f40a675c8da25cd7907a578e4230ec2d92734eca39c94c4af7e7',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 786814,
      block_hash: '00000000000000000001ba2c991ae6a5107bbc1aade24d9f3724aac929491e2e',
      block_time: 1682339651,
    },
    value: 546,
    address: 'bc1pwl57h24ecsurje63h9mlyema6gk264yrgca5y6klyya8qtqqjt2ql2j2g8',
  },
];
