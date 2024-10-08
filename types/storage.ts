export type StorageAdapter = {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
  getAllKeys?: () => Promise<string[]> | string[];
};

export type ExtendedStorageAdapter = StorageAdapter & {
  getAllKeys(): Promise<string[]> | string[];
};
