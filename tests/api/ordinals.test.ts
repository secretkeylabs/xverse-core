import { mapRareSatsAPIResponseToBundle } from 'api';
import { Bundle, UtxoOrdinalBundle } from 'types';
import { describe, expect, it } from 'vitest';

describe('rareSats', () => {
  describe('mapRareSatsAPIResponseToRareSats', () => {
    const testCases: Array<{ name: string; input: UtxoOrdinalBundle; expected: Bundle }> = [
      {
        name: 'mixed (sats, inscriptions)',
        input: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 100,
          vout: 0,
          sat_ranges: [
            {
              year_mined: 2009,
              block: 10,
              offset: 0,
              range: {
                start: '34234320000000',
                end: '34234320000001',
              },
              satributes: ['UNCOMMON', 'PIZZA', 'PALINDROME'],
              inscriptions: [],
            },
            {
              year_mined: 2009,
              block: 11,
              offset: 1,
              range: {
                start: '34234320000003',
                end: '34234320000004',
              },
              satributes: [],
              inscriptions: [
                {
                  content_type: 'image/png',
                  id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
                  inscription_number: 11067474,
                },
              ],
            },
          ],
        },
        expected: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 100,
          vout: 0,
          inscriptions: [
            {
              content_type: 'image/png',
              id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
              inscription_number: 11067474,
            },
          ],
          satributes: [['UNCOMMON', 'PIZZA', 'PALINDROME'], ['COMMON'], ['COMMON']],
          satRanges: [
            {
              yearMined: 2009,
              block: 10,
              offset: 0,
              range: {
                start: '34234320000000',
                end: '34234320000001',
              },
              satributes: ['UNCOMMON', 'PIZZA', 'PALINDROME'],
              inscriptions: [],
              totalSats: 1,
            },
            {
              yearMined: 2009,
              block: 11,
              offset: 1,
              range: {
                start: '34234320000003',
                end: '34234320000004',
              },
              satributes: ['COMMON'],
              inscriptions: [
                {
                  content_type: 'image/png',
                  id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
                  inscription_number: 11067474,
                },
              ],
              totalSats: 1,
            },
            {
              range: {
                start: '0',
                end: '0',
              },
              yearMined: 0,
              block: 0,
              offset: 0,
              satributes: ['COMMON'],
              inscriptions: [],
              totalSats: 98,
            },
          ],
          totalExoticSats: 1,
        },
      },
      {
        name: 'only rare sats',
        input: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 10,
          vout: 0,
          sat_ranges: [
            {
              year_mined: 2009,
              block: 10,
              offset: 0,
              range: {
                start: '34234320000000',
                end: '34234320000001',
              },
              satributes: ['UNCOMMON', 'PIZZA', 'PALINDROME'],
              inscriptions: [],
            },
            {
              year_mined: 2009,
              block: 11,
              offset: 1,
              range: {
                start: '34234320000003',
                end: '34234320000004',
              },
              satributes: ['1D_PALINDROME'],
              inscriptions: [],
            },
          ],
        },
        expected: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 10,
          vout: 0,
          inscriptions: [],
          satributes: [['UNCOMMON', 'PIZZA', 'PALINDROME'], ['1D_PALINDROME'], ['COMMON']],
          satRanges: [
            {
              yearMined: 2009,
              block: 10,
              offset: 0,
              range: {
                start: '34234320000000',
                end: '34234320000001',
              },
              satributes: ['UNCOMMON', 'PIZZA', 'PALINDROME'],
              inscriptions: [],
              totalSats: 1,
            },
            {
              yearMined: 2009,
              block: 11,
              offset: 1,
              range: {
                start: '34234320000003',
                end: '34234320000004',
              },
              satributes: ['1D_PALINDROME'],
              inscriptions: [],
              totalSats: 1,
            },
            {
              range: {
                start: '0',
                end: '0',
              },
              yearMined: 0,
              block: 0,
              offset: 0,
              satributes: ['COMMON'],
              inscriptions: [],
              totalSats: 8,
            },
          ],
          totalExoticSats: 2,
        },
      },
      {
        name: 'only inscriptions',
        input: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 10,
          vout: 0,
          sat_ranges: [
            {
              year_mined: 2009,
              block: 10,
              offset: 0,
              range: {
                start: '34234320000000',
                end: '34234320000001',
              },
              satributes: ['UNCOMMON'],
              inscriptions: [
                {
                  content_type: 'image/png',
                  id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
                  inscription_number: 11067474,
                },
              ],
            },
            {
              year_mined: 2009,
              block: 11,
              offset: 1,
              range: {
                start: '34234320000003',
                end: '34234320000004',
              },
              satributes: [],
              inscriptions: [
                {
                  content_type: 'image/png',
                  id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
                  inscription_number: 11067475,
                },
              ],
            },
          ],
        },
        expected: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 10,
          vout: 0,
          inscriptions: [
            {
              content_type: 'image/png',
              id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
              inscription_number: 11067474,
            },
            {
              content_type: 'image/png',
              id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
              inscription_number: 11067475,
            },
          ],
          satributes: [['UNCOMMON'], ['COMMON'], ['COMMON']],
          satRanges: [
            {
              yearMined: 2009,
              block: 10,
              offset: 0,
              range: {
                start: '34234320000000',
                end: '34234320000001',
              },
              satributes: ['UNCOMMON'],
              inscriptions: [
                {
                  content_type: 'image/png',
                  id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
                  inscription_number: 11067474,
                },
              ],
              totalSats: 1,
            },
            {
              yearMined: 2009,
              block: 11,
              offset: 1,
              range: {
                start: '34234320000003',
                end: '34234320000004',
              },
              satributes: ['COMMON'],
              inscriptions: [
                {
                  content_type: 'image/png',
                  id: '6b186d467d817e4d086a9d1bf93785d736df6431c1cc9c305571161d616d05d0i0',
                  inscription_number: 11067475,
                },
              ],
              totalSats: 1,
            },
            {
              range: {
                start: '0',
                end: '0',
              },
              yearMined: 0,
              block: 0,
              offset: 0,
              satributes: ['COMMON'],
              inscriptions: [],
              totalSats: 8,
            },
          ],
          totalExoticSats: 1,
        },
      },
      {
        name: 'unknown',
        input: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 10,
          vout: 0,
          sat_ranges: [],
        },
        expected: {
          block_height: 803128,
          txid: 'b8f8aee03af313ef1fbba7316aadf7390c91dc5dd34928a15f708ea4ed642852',
          value: 10,
          vout: 0,
          inscriptions: [],
          satributes: [['COMMON']],
          satRanges: [
            {
              range: {
                start: '0',
                end: '0',
              },
              yearMined: 0,
              block: 0,
              offset: 0,
              satributes: ['COMMON'],
              inscriptions: [],
              totalSats: 10,
            },
          ],
          totalExoticSats: 0,
        },
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        expect(mapRareSatsAPIResponseToBundle(input)).toEqual(expected);
      });
    });
  });
});
