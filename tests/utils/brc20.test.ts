import { describe, expect, it } from 'vitest';
import { getBrc20Details } from '../../utils/brc20';

describe('getBrc20Details', () => {
  [
    {
      name: 'should return undefined when content is undefined',
      inputs: {
        content: undefined,
        contentType: 'application/json',
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when contentType is undefined',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'vers', amt: '420' }),
        contentType: undefined,
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when contentType is invalid',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'vers', amt: '420' }),
        contentType: 'application/xml',
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when content is not valid JSON',
      inputs: {
        content: 'not valid json',
        contentType: 'application/json',
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when p is not brc-20',
      inputs: {
        content: JSON.stringify({ p: 'not brc-20', op: 'mint', tick: 'vers', amt: '420' }),
        contentType: 'application/json',
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when op is not valid',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'not valid', tick: 'vers', amt: '420' }),
        contentType: 'application/json',
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when tick is > 5 chars',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'xverse', amt: '4200' }),
        contentType: 'application/json',
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when tick is < 4 chars',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'xve', amt: '4200' }),
        contentType: 'application/json',
      },
      expected: undefined,
    },
    {
      name: 'should return undefined when amt is not a number',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'vers', amt: 'not a number' }),
        contentType: 'application/json',
      },
      expected: undefined,
    },
    {
      name: 'should return brc20 details when content is valid for deploy but without optional props application/json',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'deploy', tick: 'vers', max: '4200' }),
        contentType: 'application/json',
      },
      expected: {
        op: 'deploy',
        tick: 'VERS',
        value: '4200',
      },
    },
    {
      name: 'should return brc20 details when content is valid for deploy props application/json',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'deploy', tick: 'vers', max: '4200', lim: '100', dec: '8' }),
        contentType: 'application/json',
      },
      expected: {
        op: 'deploy',
        tick: 'VERS',
        value: '4200',
        lim: '100',
        dec: '8',
      },
    },
    {
      name: 'should return brc20 details when content is valid application/json',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'vers', amt: '420' }),
        contentType: 'application/json',
      },
      expected: {
        op: 'mint',
        tick: 'VERS',
        value: '420',
      },
    },
    {
      name: 'should return brc20 details when content is valid text/plain',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'vers', amt: '420' }),
        contentType: 'text/plain',
      },
      expected: {
        op: 'mint',
        tick: 'VERS',
        value: '420',
      },
    },
    {
      name: 'should return brc20 details when tick is 5-byte emoji',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'transfer', tick: 'W☮', amt: '193286' }),
        contentType: 'application/json',
      },
      expected: {
        op: 'transfer',
        tick: 'W☮',
        value: '193286',
      },
    },
    {
      name: 'should return brc20 details when tick is 4-byte emoji',
      inputs: {
        content: JSON.stringify({ p: 'brc-20', op: 'transfer', tick: '🏀', amt: '193286' }),
        contentType: 'application/json',
      },
      expected: {
        op: 'transfer',
        tick: '🏀',
        value: '193286',
      },
    },
  ].forEach(({ name, inputs, expected }) => {
    it(name, () => {
      const brc20Details = getBrc20Details(inputs.content, inputs.contentType);
      expect(brc20Details).toEqual(expected);
    });
  });
});
