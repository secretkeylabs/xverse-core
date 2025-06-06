import { describe, expect, it } from 'vitest';
import { JSONBig } from '../../utils/bignumber';

describe('JSONBig', () => {
  it('Parsing and stringifying large numbers should not lose precision', () => {
    const payload = '{"largeNumber":1234567890123456789012345678901234567890}';
    const parsed = JSONBig.parse(payload);
    expect(JSONBig.stringify(parsed)).toEqual(payload);
  });
});
