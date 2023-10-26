import { StacksCollectionData } from 'index';

type RecordType = { userNftCollectionData: StacksCollectionData[]; ttl: number };
//global value stored to be used for in-memory cache
export const nftCollection: Record<string, RecordType> = {};

export function setCacheValue(key: string, userNftCollectionData: StacksCollectionData[]) {
  const DEFAULT_TTL = 1 * 60 * 60 * 1000; // ttl for 1 hour
  // calculate ttl expiry time from current time
  const currentTime = new Date().getTime();
  const ttl = DEFAULT_TTL + currentTime;

  // store the data
  nftCollection[key] = { userNftCollectionData, ttl };
}

export function getCacheValue(key: string) {
  const val = nftCollection[key];
  // if value doesn't exist
  if (!val) return undefined;
  // if ttl has expired
  const currTime = new Date().getTime();
  if (currTime > val.ttl) {
    // delete record to save computation next time expired value is requested
    delete nftCollection[key];
    return undefined;
  }

  return val.userNftCollectionData;
}
