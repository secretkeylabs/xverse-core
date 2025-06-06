export type StorageAdapter = {
  get(key: string): Promise<string | null> | string | null;
  getMany: <T extends string>(...keys: T[]) => Promise<{ [key in T]?: string }> | { [key in T]?: string };
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
  getAllKeys?: () => Promise<string[]> | string[];
  addListener?: (
    callback: (change: { [key: string]: { newValue?: unknown; oldValue?: unknown } }) => void,
  ) => () => void;
  isErrorQuotaExceeded?: (error: Error) => boolean;
};

export type ExtendedStorageAdapter = StorageAdapter & {
  getAllKeys(): Promise<string[]> | string[];
};
