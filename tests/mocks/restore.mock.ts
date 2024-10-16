import { Account } from '../../types';

export const testSeed = 'force kite borrow once shine pluck couch swift crystal swamp crumble essay';

export const walletAccounts: Account[] = [
  {
    id: 0,
    accountType: 'software',
    masterPubKey: '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3',
    stxAddress: 'SP147ST7ESA3RES888QQMV6AK7GZK93ZR74A0GM7V',
    stxPublicKey: '025df9b0ea2c81e4f8360bf9a16638ed3678bc84dbdc04124f5db86996999aa9a8',
    btcAddresses: {
      nested: {
        address: '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr',
        publicKey: '032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff',
      },
      native: {
        address: 'bc1qf8njhm2nj48x9kltxvmc7vyl9cq7raukwg6mjk',
        publicKey: '023537a32d5ab338a6ba52f13708ea45c1e3cb33c26aff3fa182d9c66fd4b636ff',
      },
      taproot: {
        address: 'bc1pr09enf3yc43cz8qh7xwaasuv3xzlgfttdr3wn0q2dy9frkhrpdtsk05jqq',
        publicKey: '5b21869d6643175e0530aeec51d265290d036384990ee60bf089b23ff6b9a367',
      },
    },
  },
  {
    id: 1,
    accountType: 'software',
    masterPubKey: '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3',
    stxAddress: 'SP1BKESAFFV8ACW007HACXB93VHRFHP83BT24Z3NF',
    stxPublicKey: '0302ec9c40f8d5daf319bf4b1556c7f51f1eb449dd96d05e7ed42a1056451dd656',
    btcAddresses: {
      nested: {
        address: '3EMRvkWMLaUfzHPA7Un5qfLZDvbXHn385u',
        publicKey: '022e633aba8838c039b2d2214f51ed284d3da7f585744f8975606376c23483d2c1',
      },
      native: {
        address: 'bc1qu99kwysqe56s6t0lmqy6e6ksjypcdn2866emtl',
        publicKey: '0341b900cd839ea77db681e09b956af7ed74a051828d983906c90b9aeb6c827724',
      },
      taproot: {
        address: 'bc1pnc669rz0hyncjzxdgfeqm0dfhfr84ues4dwgq4lr47zpltzvekss4ptlxw',
        publicKey: '380447c41546e736f3d4bf9dc075d2301f5252f33156e3564fd393eeffdaa347',
      },
    },
  },
];
