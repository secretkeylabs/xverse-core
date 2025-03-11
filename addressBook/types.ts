// TODO: Add Starknet
export type AddressBookEntryChain = 'bitcoin' | 'stacks';

export type AddressBookEntry = {
  id: string;
  address: string;
  name: string;
  chain: AddressBookEntryChain;
  unixDateAdded: number;
};
