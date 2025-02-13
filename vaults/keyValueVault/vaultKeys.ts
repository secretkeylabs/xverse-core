import { NetworkType } from '../../types';

/**
 * Any keys that can be used in the key value vault should go here.
 *
 * They can be in the form of a function that takes arguments and returns a string, or a string. They should map to
 * a const string or string type.
 *
 * e.g.
 * const keyValueVaultKeys = {
    addressBook: (network: NetworkType) => `addressBook::${network}` as `addressBook::${NetworkType}`,
    addressThing: (address: string) => `addressThing::${address}` as `addressThing::${string}`,
    other: 'test' as const,
  };
 *
 * The key value vault will only accept keys that are defined here.
 */
export const keyValueVaultKeys = {
  addressBook: (network: NetworkType) => `addressBook::${network}` as `addressBook::${NetworkType}`,
};

type ExtractKeys<T> = T extends string ? T : T extends (...args: any) => any ? ReturnType<T> : never;

type Keys<T> = ExtractKeys<T[keyof T]>;

// The type defining the keys that the key value vault will accept
export type KeyValueVaultKey = Keys<typeof keyValueVaultKeys>;
