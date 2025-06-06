import type { PersistentStoreManager } from '.';
import { JSONCompatible } from '../utils';

type NumberRange<Num extends number, Result extends number[] = []> = Result['length'] extends Num
  ? Result[number]
  : NumberRange<Num, [...Result, Result['length']]>;

type MigrationVersions<V extends number> = V extends 0 ? never : V | Exclude<NumberRange<V>, 0>;

type Migrations<V extends number, T> = V extends 0
  ? Record<string, never>
  : {
      [K in MigrationVersions<V>]: (previousVersion: unknown) => K extends V ? Promise<T> : Promise<unknown>;
    };

export type StoreDefinition<
  T,
  V extends number,
  StoreName extends string,
  M extends (storeManager: PersistentStoreManager) => {
    [action: string]: (...args: any[]) => Promise<void>;
  },
  U extends {
    [action: string]: (...args: any[]) => unknown;
  },
> = {
  name: StoreName;
  defaultValue: JSONCompatible<T>;
  activeVersion: V;
  migrate: Migrations<V, T>;
  options?: {
    resettable?: boolean;
  };
  createMutators: M;
  utils: U;
};

export const inferStoreDefinition = <
  T,
  V extends number,
  StoreName extends string,
  M extends (storeManager: PersistentStoreManager) => {
    [action: string]: (...args: any[]) => Promise<void>;
  },
  U extends {
    [action: string]: (...args: any[]) => unknown;
  },
>(
  storeDefinition: StoreDefinition<T, V, StoreName, M, U>,
): StoreDefinition<T, V, StoreName, M, U> => storeDefinition as StoreDefinition<T, V, StoreName, M, U>;
