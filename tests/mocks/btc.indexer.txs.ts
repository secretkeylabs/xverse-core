import BigNumber from 'bignumber.js';
import { AccountBtcAddresses, ApiAddressTransaction, Rune } from '../../types';

// MARK:  Mock RunesApi getRuneInfo method
export const getRuneInfoMock = (runeId: string): Rune => ({
  id: runeId,
  entry: {
    symbol: '#',
    spaced_rune: `RUNE${runeId}`,
    divisibility: new BigNumber(4),
    block: new BigNumber(0),
    burned: new BigNumber(0),
    etching: '',
    mints: new BigNumber(0),
    number: new BigNumber(0),
    premine: new BigNumber(0),
    terms: {
      amount: new BigNumber(0),
      cap: new BigNumber(0),
      height: [new BigNumber(0), new BigNumber(0)],
      offset: [new BigNumber(0), new BigNumber(0)],
    },
    timestamp: new BigNumber(0),
  },
  mintable: true,
  parent: `inscription${runeId}`,
});

export const ownBtcAddresses: AccountBtcAddresses = {
  native: {
    address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
    publicKey: '020202020202020202020202020202020202020202020202020202020202020202',
  },
  nested: {
    address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    publicKey: '020202020202020202020202020202020202020202020202020202020202020202',
  },
  taproot: {
    address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    publicKey: '020202020202020202020202020202020202020202020202020202020202020202',
  },
};

// MARK: Inscriptions txs
export const inscriptionBurnAndSend: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1pe6kte2h685g2x2f3v5up94fhaxsx2s2qxncsx8ll0mmc0sn0es3ssw64hf',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'pkh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 869143,
  blockTime: 1730908708,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        burned: false,
        contentType: 'text/plain',
        inscribed: false,
        inscriptionId: 'd2bc97646683498ec181993977cab7a117dea955ed9620a6c51be85ea839e060i0',
        received: false,
        sent: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        burned: true,
        contentType: 'text/plain',
        inscribed: false,
        inscriptionId: '2b92f9664e562e6f45570f5983b2b09dd41ac38eaef565e047d2a4d5bf397f63i0',
        received: false,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 2332069,
      outgoing: 3270204,
      received: 0,
      sent: 938135,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 3270204,
  totalOut: 3261704,
  txid: '8ce5ff910a34d35aa1b3b3ff85d2adff5eafeb604d559926673fbf8dc4a6c70c',
};

export const inscriptionBurn: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qw0dwa9j89l4snsprw3qffks9nnuvr5ust6f02p',
        type: 'pkh',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'pkh',
        isInput: true,
        isOutput: false,
      },
    ],
  },
  blockHeight: 860333,
  blockTime: 1725732517,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        burned: true,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'a1801c8f87a6751826ee902f6143fbf4a212644853428a6f5330b65650aa88a3i0',
        received: false,
        sent: true,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 0,
      outgoing: 330,
      received: 0,
      sent: 330,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 376603,
  totalOut: 375422,
  txid: '6efb5078c623fa4d06fa3239c1faad302e853040596b41a33374b1800b3daf0d',
};

export const inscriptionInscribeHasMore: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1pvweyc4wfumtl4r86349p6p55kx66k9c0d0gqglkzvfe5zj2x70zscp6fr9',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7f24atnccv7csanq3ujz7x8de740k4vpxfwfj9',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 858563,
  blockTime: 1724707788,
  inscriptions: {
    hasMore: true,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i0',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i1',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i2',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i3',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i4',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i5',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i6',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i7',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i8',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696i9',
        received: true,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 330000,
      outgoing: 0,
      received: 330000,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 527682,
  totalOut: 369978,
  txid: '54ebc9b442ee70dada61445418d288c7f31ea8d332c5ae9d64bb52d824e00696',
};

export const inscriptionInscribeAndReceive: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1pkl8fk9n59ruh3akkfm2pf0j5xxmgptlmvf9gavgkqqerluh2x0esjqmjf6',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
    ],
  },
  blockHeight: 838420,
  blockTime: 1712646399,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'image/png',
        inscribed: false,
        inscriptionId: '9f24c4c5b58ba82fe38e15181b00f0bb090046f85a4c6ebecb0bafeb91c355dfi0',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'image/png',
        inscribed: true,
        inscriptionId: 'ebd6de8f405bd2b1f056eabf11e4bbe98bb406269088e323fa67bc25024515cci0',
        received: true,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 1092,
      outgoing: 0,
      received: 1092,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 9508,
  totalOut: 1092,
  txid: 'ebd6de8f405bd2b1f056eabf11e4bbe98bb406269088e323fa67bc25024515cc',
};

export const inscriptionInscribeOne: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1ptysvrmq7cjsxfzz9a45j9jtn6ljz6uxp73kmdx4elmfuyrsu5ews5rxq05',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1pvpnmqsyct40xm5ta3r5x59rn7wwskzdpdmzv7lcyz8glxqlfkr4syfgsy4',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 869287,
  blockTime: 1730986788,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        burned: false,
        contentType: 'text/plain',
        inscribed: true,
        inscriptionId: '375580abbd09cdb7d5dd1e153d8d6dc9020fd391fa4fe4ffbd4e6b4c450c4785i0',
        received: true,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 330,
      outgoing: 0,
      received: 330,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 33552263,
  totalOut: 33548399,
  txid: '375580abbd09cdb7d5dd1e153d8d6dc9020fd391fa4fe4ffbd4e6b4c450c4785',
};

export const inscriptionReceiveTwo: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1ppfwy6c4ldmv2jj9gkyayt0ejmgjcuy955qlnr2682p6fnazr2nkqrkzd7h',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: '39JmBRz43rS1zRjQvhqYkPWZmwKqQrgwWZ',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 868424,
  blockTime: 1730474734,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'image/png',
        inscribed: false,
        inscriptionId: '72591a17a1aeb7931a68db524ff755e82210eb50523443fc88cb9baa93daa455i0',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/html',
        inscribed: false,
        inscriptionId: '922b2a49e348d6e613c7d276b3289a8314002c8c93257c57b327a54aefb61e20i0',
        received: true,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 1092,
      outgoing: 0,
      received: 1092,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 11480,
  totalOut: 8800,
  txid: '11a6e22bb4325221528b9b35d845c04ff913b928e0c0d40f9b6fd466204ab748',
};

export const inscriptionSendTwo: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1ppfwy6c4ldmv2jj9gkyayt0ejmgjcuy955qlnr2682p6fnazr2nkqrkzd7h',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 868424,
  blockTime: 1730474734,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'image/png',
        inscribed: false,
        inscriptionId: '72591a17a1aeb7931a68db524ff755e82210eb50523443fc88cb9baa93daa455i0',
        received: false,
        sent: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/html',
        inscribed: false,
        inscriptionId: '922b2a49e348d6e613c7d276b3289a8314002c8c93257c57b327a54aefb61e20i0',
        received: false,
        sent: true,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 0,
      outgoing: 1092,
      received: 0,
      sent: 1092,
    },
    {
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
      incoming: 7788,
      outgoing: 10388,
      received: 0,
      sent: 2600,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 11480,
  totalOut: 8800,
  txid: '11a6e22bb4325221528b9b35d845c04ff913b928e0c0d40f9b6fd466204ab749',
};

// MARK: Runes txs
export const runeAirDropAddressesHasMore: ApiAddressTransaction = {
  addressList: {
    hasMore: true,
    items: [
      {
        address: 'bc1pv38dc0w3cnlsv7auv2ukgw32rw3knf3uv9v7nadnd8ca9wuj3svqfmnk9j',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1puzl0pkmc3tfuc996n75n59jz6qcmdh45hcsduj62v0ukk24ej7ws3z27lc',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1pmyq8h28xjfrgqjwe0q7es8hanuhrgequ0d3qe6kz2av7knj624sqzs3z6j',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qdhv4sgqrstyxmn96pzqdn4vg930ydc7qzn7ldd',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1p9wh2e4xqq6sm800fres6uzl6cmg5grs8av2f8g8dak4mn24gcv5s2dmvdl',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1ps9vkafq3hxvzg4stypacl2cf35l3xp476u6d3zyfx4sy76amxlxqz6a4wk',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1p6yf6905a8t3gztkqnfclezywn0qd6x9e0jqktpdp3zvsn8ffaeyqk73cut',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qpxqmm7ruv9ar6sjc88w3pdyfl75rvm3lpf8gy9',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1p5redq0s34wp94ghngn8fkkhqv83xfsdqaxqpnnegacswkf8d073qrwgmf5',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 840654,
  blockTime: 1713961641,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 546,
      outgoing: 0,
      received: 546,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '58460254200000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '58460254200000',
          runeId: '840000:3',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '800825400000',
          outgoing: '0',
          received: '800825400000',
          runeId: '840000:3',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 503838,
  totalOut: 39858,
  txid: 'e79cbd2fb7c1e8e0163ebca1e257bd44d0a5128185c1d90e2f97d2ba67bcd39e',
};

export const runeSendOneAddessesHasMore: ApiAddressTransaction = {
  addressList: {
    hasMore: true,
    items: [
      {
        address: 'bc1pv38dc0w3cnlsv7auv2ukgw32rw3knf3uv9v7nadnd8ca9wuj3svqfmnk9j',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1puzl0pkmc3tfuc996n75n59jz6qcmdh45hcsduj62v0ukk24ej7ws3z27lc',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1pmyq8h28xjfrgqjwe0q7es8hanuhrgequ0d3qe6kz2av7knj624sqzs3z6j',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qdhv4sgqrstyxmn96pzqdn4vg930ydc7qzn7ldd',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1p9wh2e4xqq6sm800fres6uzl6cmg5grs8av2f8g8dak4mn24gcv5s2dmvdl',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1ps9vkafq3hxvzg4stypacl2cf35l3xp476u6d3zyfx4sy76amxlxqz6a4wk',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1p6yf6905a8t3gztkqnfclezywn0qd6x9e0jqktpdp3zvsn8ffaeyqk73cut',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qpxqmm7ruv9ar6sjc88w3pdyfl75rvm3lpf8gy9',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1q555ldrrg2sjg0aq9jfzzfw0smzjjt5l9zyzz7h',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 840654,
  blockTime: 1713961641,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 0,
      outgoing: 503838,
      received: 0,
      sent: 503838,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '58460254200000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '58460254200000',
          runeId: '840000:3',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '0',
          outgoing: '58460254200000',
          received: '0',
          runeId: '840000:3',
          sent: '58460254200000',
        },
      ],
    },
  },
  totalIn: 503838,
  totalOut: 39858,
  txid: 'e79cbd2fb7c1e8e0163ebca1e257bd44d0a5128185c1d90e2f97d2ba67bcd39f',
};

export const runeBurnAndMintBurned: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 843090,
  blockTime: 1715481005,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 109491,
      outgoing: 109623,
      received: 0,
      sent: 132,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '13000000',
          isBurn: true,
          isEtch: false,
          isMint: false,
          outgoing: '13000000',
          runeId: '842549:80',
        },
        {
          incoming: '10000000000000',
          isBurn: true,
          isEtch: false,
          isMint: true,
          outgoing: '10000000000000',
          runeId: '842994:159',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '0',
          outgoing: '13000000',
          received: '0',
          runeId: '842549:80',
          sent: '13000000',
        },
      ],
    },
  },
  totalIn: 109623,
  totalOut: 109491,
  txid: '018a0989a5ccaae713ec902794a88186a7a66c33f85ed2abc98e09892d108ce8',
};

export const runeBurnMinted: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 843090,
  blockTime: 1715481005,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 106059,
      outgoing: 109491,
      received: 0,
      sent: 3432,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '0',
          isBurn: true,
          isEtch: false,
          isMint: true,
          outgoing: '0',
          runeId: '842994:159',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 109491,
  totalOut: 106059,
  txid: '0013cb4112c6cabc9bf09a29714c36c6ebd678467c3df9e328a261efc419d566',
};

export const runeBurnPartial: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 863340,
  blockTime: 1727603401,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 546,
      outgoing: 546,
      received: 0,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '888000000000',
          isBurn: true,
          isEtch: false,
          isMint: false,
          outgoing: '888000000000',
          runeId: '840080:127',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '882500000000',
          outgoing: '888000000000',
          received: '0',
          runeId: '840080:127',
          sent: '5500000000',
        },
      ],
    },
  },
  totalIn: 2346,
  totalOut: 1200,
  txid: 'fc7a6d09f020ba6a4835c157232318b0032f9e1fe2e6f62d8b98aab702feeb36',
};

export const runeBurnAndInscriptionSend: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1qj6t3xvus9f6yukgufgkvtra74u3pp8e48qv9lj',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'pkh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 843870,
  blockTime: 1715956695,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: '714ae45a8c5392331430250991f05998f0a412564c95c12c61eecd42936926bai0',
        received: false,
        sent: true,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 546,
      outgoing: 135130,
      received: 0,
      sent: 134584,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '20997060',
          isBurn: true,
          isEtch: false,
          isMint: false,
          outgoing: '20997060',
          runeId: '843855:534',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
          incoming: '0',
          outgoing: '20997060',
          received: '0',
          runeId: '843855:534',
          sent: '20997060',
        },
      ],
    },
  },
  totalIn: 135130,
  totalOut: 120546,
  txid: '666a69e52a20b86d6fa2b29b724dd0f4020a74b5cddf3a574d0c6638d9828c75',
};

export const runeConsolidate: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'pkh',
        isInput: true,
        isOutput: true,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 862073,
  blockTime: 1726809864,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 19000,
      outgoing: 35610,
      received: 0,
      sent: 16610,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '9000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '9000',
          runeId: '1:0',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
          incoming: '9000',
          outgoing: '9000',
          received: '0',
          runeId: '1:0',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 35610,
  totalOut: 19000,
  txid: '3dc854f7f0bfc5ffe05ae1bdd76166de91609a78e7b2919b6b7a6e944f9b6404',
};

export const runeSplit: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1p2hfnkz4vgys7a6akkpsp23drlzsdtvu25qhh2vzfsrfv96k9zcgsdfs764',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 858508,
  blockTime: 1724667380,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 72806,
      outgoing: 95528,
      received: 0,
      sent: 22722,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '100',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '100',
          runeId: '1:0',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '100',
          outgoing: '100',
          received: '0',
          runeId: '1:0',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 95528,
  totalOut: 81806,
  txid: '6638bff14bf7949c1ddbd4abcdc304b7d9c7b4300f58286f90d1c62a81483d61',
};

export const runeEtchWithInscription: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1pvnfjks2y4hzc29nkxuul99w99mupru3nxxyj8ntvnurhw6lgt86sw77caw',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
    ],
  },
  blockHeight: 864877,
  blockTime: 1728466580,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'image/jpeg',
        inscribed: true,
        inscriptionId: 'd7f65eb2c538f828ce64360bdd5fc1cae8c223158d1406d508e7df7a15d46dcbi0',
        received: true,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 546,
      outgoing: 0,
      received: 546,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '0',
          isBurn: false,
          isEtch: true,
          isMint: false,
          outgoing: '0',
          runeId: '864877:904',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  totalIn: 5790,
  totalOut: 546,
  txid: 'd7f65eb2c538f828ce64360bdd5fc1cae8c223158d1406d508e7df7a15d46dcb',
};

export const runeEtchWithPremine: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1ptxacu4v7ts8jdz96ru2hun9zqanzt0kz85pdk554y0rnw965e62qu47srz',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 840000,
  blockTime: 1713571767,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 10000,
      outgoing: 0,
      received: 10000,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '10000000000000000',
          isBurn: false,
          isEtch: true,
          isMint: false,
          outgoing: '10000000000000000',
          runeId: '840000:3',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '10000000000000000',
          outgoing: '0',
          received: '10000000000000000',
          runeId: '840000:3',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 290783340,
  totalOut: 10330,
  txid: 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1376',
};

export const runeEtchWithInscriptionAndPremine: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1pdd8xhk45lc6tghzd89klsyhujavldke95nc55rmjfctalg7ckrnsvgezx0',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 840000,
  blockTime: 1713571767,
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        burned: false,
        contentType: undefined,
        inscribed: true,
        inscriptionId: 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375i0',
        received: true,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 10000,
      outgoing: 0,
      received: 10000,
      sent: 0,
    },
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 330,
      outgoing: 0,
      received: 330,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '10000000000000000',
          isBurn: false,
          isEtch: true,
          isMint: false,
          outgoing: '10000000000000000',
          runeId: '840000:3',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '10000000000000000',
          outgoing: '0',
          received: '10000000000000000',
          runeId: '840000:3',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 290783340,
  totalOut: 10330,
  txid: 'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375',
};

export const runeMintAndSendInscriptionsHasMore: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 869361,
  blockTime: 1731028713,
  inscriptions: {
    hasMore: true,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'e8e71c0ad24d5676d35d8faa3227348f02bf1605b4703f13a0be65a6e0c5676bi0',
        received: false,
        sent: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: '256c1066997f2b8d7240d9c50035b37804fb79237cb1c81c25356878da8ac81bi0',
        received: false,
        sent: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: '10d1edbbb64149a327570d62e5ab4e2e1a75a721dd2cc4a3fadd051bb9e1250fi0',
        received: false,
        sent: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'aac2c19e79b42e06ffb476f9275d44070ba0638cd3d84196831c6221d9b91312i0',
        received: false,
        sent: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: '823bdb23114977f416f2ae902f030cc45552ea3c5c29facca185bba2c7aa0fb0i0',
        received: false,
        sent: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: '6567af9f947e1d9ea4e12a6c0874252442a9ba56d829fe5f95f776e13bd69ab1i0',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: '484af92b7ead6da9bfa21de0055714d196ec8d837e12a0dce2654df0d930effbi0',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: '5396d73f69727a88ea0208a9fdf81226bb392678f253dda711b490201327633di0',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'fd555d39050735755d34d040e174e6df70ec483abab658b45e12f3c4f2257b63i0',
        received: true,
        sent: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'ca67020603e12596832fa7632f437057e959e2f1f85161cdf20edf01ee6dba95i0',
        received: true,
        sent: false,
      },
    ],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 249525,
      outgoing: 250045,
      received: 0,
      sent: 520,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '140000',
          isBurn: false,
          isEtch: false,
          isMint: true,
          outgoing: '140000',
          runeId: '869349:2029',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '140000',
          outgoing: '120000',
          received: '20000',
          runeId: '869349:2029',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 250045,
  totalOut: 249525,
  txid: '2c307f0a4e36b4af92f62c96398cb9c59f46f91d401ae9bd3c54ad19ea5fa099',
};

export const runeMintWithExistingRuneBalance: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'wpkh',
        isInput: true,
        isOutput: true,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 869103,
  blockTime: 1730890630,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 3339,
      outgoing: 4242,
      received: 0,
      sent: 903,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '4500000000',
          isBurn: false,
          isEtch: false,
          isMint: true,
          outgoing: '4500000000',
          runeId: '869099:945',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '4500000000',
          outgoing: '4000000000',
          received: '500000000',
          runeId: '869099:945',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 4242,
  totalOut: 3339,
  txid: '6a66a1ca2f3940d66f6607248086ec8ad7cca5191068af6b57a6d76bfa0fa115',
};

export const runeMintWithoutRuneBalance: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1qlzdswzqyhu0zgh3d3k8mtw7cxyzju6nc40t53f',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qkc032nxgav6l6ev9ltahm6yt2f9n9rzw40xalk',
        type: 'wpkh',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 869959,
  blockTime: 1731399775,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 1956,
      outgoing: 10866,
      received: 0,
      sent: 8910,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '2100',
          isBurn: false,
          isEtch: false,
          isMint: true,
          outgoing: '2100',
          runeId: '843261:3229',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '2100',
          outgoing: '0',
          received: '2100',
          runeId: '843261:3229',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 10866,
  totalOut: 8956,
  txid: 'd80d7ae9b5a136577a6b937c3e8895439e0f7087009f9dcefbcc3c1b49a1b782',
};

export const runeOwnActivityHasMore: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: 'bc1pzrq4kaftwdzu284qmkzyl5yf96nfywschsnkj68d4h7w230fhpdssx2e4l',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  blockHeight: 854341,
  blockTime: 1722177765,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 10697778,
      outgoing: 0,
      received: 10697778,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: true,
      items: [
        {
          incoming: '52500000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '52500000',
          runeId: '840000:1164',
        },
        {
          incoming: '2562000000000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '2562000000000000',
          runeId: '840000:1231',
        },
        {
          incoming: '22500000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '22500000',
          runeId: '840000:136',
        },
        {
          incoming: '720000000000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '720000000000000',
          runeId: '840000:1611',
        },
        {
          incoming: '5760000000000000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '5760000000000000000',
          runeId: '840000:177',
        },
        {
          incoming: '72000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '72000',
          runeId: '840000:1801',
        },
        {
          incoming: '100000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '100000',
          runeId: '840000:2026',
        },
        {
          incoming: '25000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '25000',
          runeId: '840000:2125',
        },
        {
          incoming: '42000000000000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '42000000000000000',
          runeId: '840000:2333',
        },
        {
          incoming: '2500000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '2500000000',
          runeId: '840000:245',
        },
      ],
    },
    ownActivity: {
      hasMore: true,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '52500000',
          outgoing: '0',
          received: '52500000',
          runeId: '840000:1164',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '2562000000000000',
          outgoing: '0',
          received: '2562000000000000',
          runeId: '840000:1231',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '22500000',
          outgoing: '0',
          received: '22500000',
          runeId: '840000:136',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '720000000000000',
          outgoing: '0',
          received: '720000000000000',
          runeId: '840000:1611',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '5760000000000000000',
          outgoing: '0',
          received: '5760000000000000000',
          runeId: '840000:177',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '72000',
          outgoing: '0',
          received: '72000',
          runeId: '840000:1801',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '100000',
          outgoing: '0',
          received: '100000',
          runeId: '840000:2026',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '25000',
          outgoing: '0',
          received: '25000',
          runeId: '840000:2125',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '42000000000000000',
          outgoing: '0',
          received: '42000000000000000',
          runeId: '840000:2333',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '2500000000',
          outgoing: '0',
          received: '2500000000',
          runeId: '840000:245',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 10699078,
  totalOut: 10697778,
  txid: 'd8633d61d6b56851c5f9ed83424ba8efed514af0255cf4dab60904370670544c',
};

export const runeReceiveTwo: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1perl3cx6j4d8mpez4er79h90ervefmmy0mct90xl7hzdrkasfuqdsmaksrt',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
    ],
  },
  blockHeight: 840806,
  blockTime: 1714041958,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 2184,
      outgoing: 0,
      received: 2184,
      sent: 0,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '42000000000000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '42000000000000000',
          runeId: '840000:2333',
        },
        {
          incoming: '2500000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '2500000000',
          runeId: '840000:245',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '42000000000000000',
          outgoing: '0',
          received: '42000000000000000',
          runeId: '840000:2333',
          sent: '0',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '2500000000',
          outgoing: '0',
          received: '2500000000',
          runeId: '840000:245',
          sent: '0',
        },
      ],
    },
  },
  totalIn: 500546,
  totalOut: 479622,
  txid: '10d3b216297998b724c69b1d1fa9bf016924bbecd19803ca2c962258a0a77a0b',
};

export const runeSendTwo: ApiAddressTransaction = {
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1p3dnrhlp05lfx5z2mgheqmrktxsqjrhpxwxxeqp437zxwh59fgvus9nmut3',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'pkh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  blockHeight: 854341,
  blockTime: 1722177765,
  inscriptions: {
    hasMore: false,
    items: [],
  },
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 1092,
      outgoing: 1092,
      received: 0,
      sent: 1092,
    },
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 5870157,
      outgoing: 5892157,
      received: 0,
      sent: 22000,
    },
  ],
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '29170800000000000000000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '29170800000000000000000',
          runeId: '840000:314',
        },
        {
          incoming: '750000',
          isBurn: false,
          isEtch: false,
          isMint: false,
          outgoing: '750000',
          runeId: '840000:340',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '0',
          outgoing: '29170800000000000000000',
          received: '0',
          runeId: '840000:314',
          sent: '29170800000000000000000',
        },
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '0',
          outgoing: '750000',
          received: '0',
          runeId: '840000:340',
          sent: '750000',
        },
      ],
    },
  },
  totalIn: 5893249,
  totalOut: 5871249,
  txid: '398fb42bd308473d5ea09c161252fd4add6887688b995bc007512913c245973b',
};

export const runePartialSendOne: ApiAddressTransaction = {
  blockHeight: 883191,
  blockTime: 1739204894,
  txid: '94fdcfa4fae93644d60b51bd7996c6d3d92eebf87444fe88b1d04758c2acfb6b',
  ownActivity: [
    {
      sent: 0,
      received: 0,
      outgoing: 546,
      incoming: 546,
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    },
    {
      sent: 1434,
      received: 0,
      outgoing: 30039,
      incoming: 28605,
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    },
  ],
  totalIn: 30585,
  totalOut: 29697,
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1ppfwy6c4ldmv2jj9gkyayt0ejmgjcuy955qlnr2682p6fnazr2nkqrkzd7h',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [
        {
          runeId: '1:0',
          outgoing: '48',
          incoming: '48',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
      ],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          runeId: '1:0',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '3',
          received: '0',
          outgoing: '48',
          incoming: '45',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [],
  },
};

export const runeSendOneConsolidateOne: ApiAddressTransaction = {
  blockHeight: 883418,
  blockTime: 1739359270,
  txid: 'b48dfbc306abd032db4bf732e3194a72c6c8cc1779d21b4cc1e2dd0df4d41793',
  ownActivity: [
    {
      sent: 0,
      received: 54,
      outgoing: 546,
      incoming: 600,
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    },
    {
      sent: 14,
      received: 0,
      outgoing: 28911,
      incoming: 28897,
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    },
  ],
  totalIn: 88457,
  totalOut: 85473,
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1pfljyeeyuddpj993expqnsngw2kjt4887we2rf3w00qj7csecxqgsqlae2l',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [
        {
          runeId: '1:0',
          outgoing: '45',
          incoming: '45',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
        {
          runeId: '840000:3',
          outgoing: '385789160',
          incoming: '385789160',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
      ],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          runeId: '1:0',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '0',
          received: '0',
          outgoing: '45',
          incoming: '45',
        },
        {
          runeId: '840000:3',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '100000000',
          received: '0',
          outgoing: '385789160',
          incoming: '285789160',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [],
  },
};

export const runeBurnOneAndConsolidateTwo: ApiAddressTransaction = {
  blockHeight: 883310,
  blockTime: 1739280871,
  txid: '7eb47951b6ce807be294dff1f663b6018cfc976f1818e164c574f0c020dfe339',
  ownActivity: [
    {
      sent: 3564,
      received: 0,
      outgoing: 4164,
      incoming: 600,
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    },
    {
      sent: 0,
      received: 1350,
      outgoing: 29918,
      incoming: 31268,
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    },
  ],
  totalIn: 134082,
  totalOut: 126072,
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1pfljyeeyuddpj993expqnsngw2kjt4887we2rf3w00qj7csecxqgsqlae2l',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [
        {
          runeId: '840000:183',
          outgoing: '1',
          incoming: '1',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
        {
          runeId: '840000:2',
          outgoing: '1000',
          incoming: '1000',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
        {
          runeId: '840000:3',
          outgoing: '486097716',
          incoming: '486097716',
          isMint: false,
          isEtch: false,
          isBurn: true,
        },
      ],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          runeId: '840000:183',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '0',
          received: '0',
          outgoing: '1',
          incoming: '1',
        },
        {
          runeId: '840000:2',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '0',
          received: '0',
          outgoing: '1000',
          incoming: '1000',
        },
        {
          runeId: '840000:3',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '486097716',
          received: '0',
          outgoing: '486097716',
          incoming: '0',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [],
  },
};

// MARK: Multiple assets
export const multipleAssetsSendTwo: ApiAddressTransaction = {
  blockHeight: 883191,
  blockTime: 1739204894,
  txid: '94fdcfa4fae93644d60b51bd7996c6d3d92eebf87444fe88b1d04758c2acfb6b',
  ownActivity: [
    {
      sent: 1092,
      received: 0,
      outgoing: 1092,
      incoming: 0,
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    },
    {
      sent: 28605,
      received: 0,
      outgoing: 29493,
      incoming: 8888,
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    },
  ],
  totalIn: 30585,
  totalOut: 29697,
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1ppfwy6c4ldmv2jj9gkyayt0ejmgjcuy955qlnr2682p6fnazr2nkqrkzd7h',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [
        {
          runeId: '1:0',
          outgoing: '48',
          incoming: '48',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
      ],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          runeId: '1:0',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '3',
          received: '0',
          outgoing: '48',
          incoming: '45',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/html',
        inscribed: false,
        inscriptionId: '922b2a49e348d6e613c7d276b3289a8314002c8c93257c57b327a54aefb61e20i0',
        received: false,
        sent: true,
      },
    ],
  },
};

export const multipleAssetsReceiveTwo: ApiAddressTransaction = {
  blockHeight: 883192,
  blockTime: 1739204895,
  txid: '94fdcfa4fae93644d60b51bd7996c6d3d92eebf87444fe88b1d04758c2acfb6c',
  ownActivity: [
    {
      sent: 0,
      received: 1092,
      outgoing: 0,
      incoming: 1092,
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    },
  ],
  totalIn: 30585,
  totalOut: 29697,
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1ppfwy6c4ldmv2jj9gkyayt0ejmgjcuy955qlnr2682p6fnazr2nkqrkzd7h',
        type: 'tr',
        isInput: true,
        isOutput: false,
      },
      {
        address: '39JmBRz43rS1zRjQvhqYkPWZmwKqQrgwWZ',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [
        {
          runeId: '1:0',
          outgoing: '48',
          incoming: '48',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
      ],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          runeId: '1:0',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '0',
          received: '48',
          outgoing: '0',
          incoming: '48',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/html',
        inscribed: false,
        inscriptionId: '922b2a49e348d6e613c7d276b3289a8314002c8c93257c57b327a54aefb61e20i0',
        received: true,
        sent: false,
      },
    ],
  },
};

export const multipleAssetsBurnTwo: ApiAddressTransaction = {
  blockHeight: 883193,
  blockTime: 1739204896,
  txid: '94fdcfa4fae93644d60b51bd7996c6d3d92eebf87444fe88b1d04758c2acfb6d',
  ownActivity: [
    {
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      incoming: 546,
      outgoing: 876,
      received: 0,
      sent: 330,
    },
    {
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      incoming: 28809,
      outgoing: 29711,
      received: 0,
      sent: 888,
    },
  ],
  totalIn: 30585,
  totalOut: 29697,
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'pkh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      hasMore: false,
      items: [
        {
          incoming: '888000000000',
          isBurn: true,
          isEtch: false,
          isMint: false,
          outgoing: '888000000000',
          runeId: '840080:127',
        },
      ],
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          incoming: '882500000000',
          outgoing: '888000000000',
          received: '0',
          runeId: '840080:127',
          sent: '5500000000',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: true,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'a1801c8f87a6751826ee902f6143fbf4a212644853428a6f5330b65650aa88a3i0',
        received: false,
        sent: true,
      },
    ],
  },
};

export const multipleAssetsSendTwoConsolidateOne: ApiAddressTransaction = {
  blockHeight: 883418,
  blockTime: 1739359270,
  txid: 'b48dfbc306abd032db4bf732e3194a72c6c8cc1779d21b4cc1e2dd0df4d41793',
  ownActivity: [
    {
      sent: 276,
      received: 0,
      outgoing: 876,
      incoming: 600,
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    },
    {
      sent: 14,
      received: 0,
      outgoing: 28911,
      incoming: 28897,
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    },
  ],
  totalIn: 88457,
  totalOut: 85473,
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1pfljyeeyuddpj993expqnsngw2kjt4887we2rf3w00qj7csecxqgsqlae2l',
        type: 'tr',
        isInput: false,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [
        {
          runeId: '1:0',
          outgoing: '45',
          incoming: '45',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
        {
          runeId: '840000:3',
          outgoing: '385789160',
          incoming: '385789160',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
      ],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          runeId: '1:0',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '0',
          received: '0',
          outgoing: '45',
          incoming: '45',
        },
        {
          runeId: '840000:3',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '100000000',
          received: '0',
          outgoing: '385789160',
          incoming: '285789160',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: false,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'a1801c8f87a6751826ee902f6143fbf4a212644853428a6f5330b65650aa88a3i0',
        received: false,
        sent: true,
      },
    ],
  },
};

export const multipleAssetsBurnTwoConsolidateOne: ApiAddressTransaction = {
  blockHeight: 883418,
  blockTime: 1739359270,
  txid: 'b48dfbc306abd032db4bf732e3194a72c6c8cc1779d21b4cc1e2dd0df4d41793',
  ownActivity: [
    {
      sent: 276,
      received: 0,
      outgoing: 876,
      incoming: 600,
      address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
    },
    {
      sent: 14,
      received: 0,
      outgoing: 28911,
      incoming: 28897,
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    },
  ],
  totalIn: 88457,
  totalOut: 85473,
  addressList: {
    hasMore: false,
    items: [
      {
        address: undefined,
        type: 'op_return',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        type: 'tr',
        isInput: true,
        isOutput: true,
      },
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [
        {
          runeId: '1:0',
          outgoing: '45',
          incoming: '45',
          isMint: false,
          isEtch: false,
          isBurn: false,
        },
        {
          runeId: '840000:3',
          outgoing: '385789160',
          incoming: '385789160',
          isMint: false,
          isEtch: false,
          isBurn: true,
        },
      ],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [
        {
          runeId: '1:0',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '0',
          received: '0',
          outgoing: '45',
          incoming: '45',
        },
        {
          runeId: '840000:3',
          address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
          sent: '100000000',
          received: '0',
          outgoing: '385789160',
          incoming: '285789160',
        },
      ],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [
      {
        address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
        burned: true,
        contentType: 'text/plain;charset=utf-8',
        inscribed: false,
        inscriptionId: 'a1801c8f87a6751826ee902f6143fbf4a212644853428a6f5330b65650aa88a3i0',
        received: false,
        sent: true,
      },
    ],
  },
};

// MARK: btc txs
export const receiveBtcWithMultipleExternalAddresses: ApiAddressTransaction = {
  blockHeight: 887139,
  blockTime: 1741593618,
  txid: '80f115b06250a8ed3811d917fc26648f2a4592a21702d6360586cd34c939d642',
  ownActivity: [
    {
      sent: 0,
      received: 36369,
      outgoing: 0,
      incoming: 36369,
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
    },
  ],
  totalIn: 103946087,
  totalOut: 103945287,
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1q8pmuc2v0cku2ty0rfxp2jyvrhv6lpsjzq9y6s8',
        type: 'pkh',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1qkpcm5cthgwt24ypdmnpmgfgw5ha4n6vt6dfzxz',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qd9lswf8djg7lts56fu3s3ff82ymn65elh934xr',
        type: 'pkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'wpkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qd3laau2nsq26kml0v93hp94kax6sxt23hwelwd',
        type: 'wpkh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1qjq0a06lu2y9068786mev5pnjc4khxhejqmsanp',
        type: 'wpkh',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [],
  },
};

export const sendBtcToTwoAddresses: ApiAddressTransaction = {
  blockHeight: 886582,
  blockTime: 1741272617,
  txid: '0102dcc296785aa4ce5e966cccce486e313aac89ab8f2d05d7ea81988a90fb77',
  ownActivity: [
    {
      sent: 57025,
      received: 0,
      outgoing: 62422,
      incoming: 5397,
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
    },
  ],
  totalIn: 62422,
  totalOut: 60397,
  addressList: {
    hasMore: false,
    items: [
      {
        address: 'bc1q2n9rrd5rg0fsvuh30eqwtpm7uqyl5ww68de5mdpyvnudx93n56tsm6w44x',
        type: 'wsh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'wpkh',
        isInput: true,
        isOutput: true,
      },
      {
        address: 'bc1qlfedd4elqxpkd7sae45z8mltjwp0fw44sk0a20x4e7athh9yru3s6nmxm6',
        type: 'wsh',
        isInput: false,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [],
  },
};

export const consolidateBtc: ApiAddressTransaction = {
  blockHeight: 887252,
  blockTime: 1741655145,
  txid: '79b8b804a4e7aa77153a8f1628a76b9eb2cde7d417d6382e57b43ed4a5fd8cd4',
  ownActivity: [
    {
      sent: 16304,
      received: 0,
      outgoing: 200000,
      incoming: 183696,
      address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
    },
    {
      sent: 0,
      received: 15594,
      outgoing: 0,
      incoming: 15594,
      address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
    },
  ],
  totalIn: 200000,
  totalOut: 199290,
  addressList: {
    hasMore: false,
    items: [
      {
        address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb',
        type: 'sh',
        isInput: false,
        isOutput: true,
      },
      {
        address: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
        type: 'wpkh',
        isInput: true,
        isOutput: true,
      },
    ],
  },
  runes: {
    allActivity: {
      items: [],
      hasMore: false,
    },
    ownActivity: {
      hasMore: false,
      items: [],
    },
  },
  inscriptions: {
    hasMore: false,
    items: [],
  },
};
