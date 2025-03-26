import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressBook, ErrorCodes } from '../../addressBook';
import { KeyValueVaultKey, MasterVault } from '../../vaults';
import { walletAccounts } from '../mocks/restore.mock';

describe('Address Book', () => {
  const masterVault = {
    KeyValueVault: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  } as unknown as MasterVault;

  beforeEach(() => {
    vi.resetAllMocks();

    const stubbedVault: { [key in KeyValueVaultKey]?: unknown } = {};
    vi.mocked(masterVault.KeyValueVault.get).mockImplementation(async (key: KeyValueVaultKey) => {
      return stubbedVault[key] as any;
    });
    vi.mocked(masterVault.KeyValueVault.set).mockImplementation(async (key: KeyValueVaultKey, value: any) => {
      stubbedVault[key] = value;
    });
    vi.mocked(masterVault.KeyValueVault.remove).mockImplementation(async (key: KeyValueVaultKey) => {
      delete stubbedVault[key];
    });
  });

  it('should add and get an address to/from the address book', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });

    const entries = await addressBook.getEntries();

    expect(entries).toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);
  });

  it('should edit an address in the address book', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    const entry0Id = await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });
    await addressBook.addEntry({
      address: walletAccounts[1].btcAddresses.taproot.address,
      name: 'Bob',
    });
    await addressBook.addEntry({
      address: walletAccounts[1].stxAddress,
      name: 'Rick',
    });

    let entries = await addressBook.getEntries();

    expect(entries).toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].btcAddresses.taproot.address,
        name: 'Bob',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].stxAddress,
        name: 'Rick',
        chain: 'stacks',
        unixDateAdded: expect.any(Number),
      },
    ]);

    await addressBook.editEntry(entry0Id, { name: 'Andrea' });

    entries = await addressBook.getEntries();

    expect(entries).toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Andrea',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].btcAddresses.taproot.address,
        name: 'Bob',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].stxAddress,
        name: 'Rick',
        chain: 'stacks',
        unixDateAdded: expect.any(Number),
      },
    ]);

    await addressBook.editEntry(entry0Id, { address: walletAccounts[0].stxAddress });

    entries = await addressBook.getEntries();

    expect(entries).toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[0].stxAddress,
        name: 'Andrea',
        chain: 'stacks',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].btcAddresses.taproot.address,
        name: 'Bob',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].stxAddress,
        name: 'Rick',
        chain: 'stacks',
        unixDateAdded: expect.any(Number),
      },
    ]);
  });

  it('should remove an entry from the address book', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    const firstEntryId = await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });
    await addressBook.addEntry({
      address: walletAccounts[1].btcAddresses.taproot.address,
      name: 'Bob',
    });

    let entries = await addressBook.getEntries();

    expect(entries).toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].btcAddresses.taproot.address,
        name: 'Bob',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);

    await addressBook.removeEntry(firstEntryId);

    entries = await addressBook.getEntries();

    expect(entries).toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[1].btcAddresses.taproot.address,
        name: 'Bob',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);
  });

  it('should clear all entries from the address book', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });
    await addressBook.addEntry({
      address: walletAccounts[1].btcAddresses.taproot.address,
      name: 'Bob',
    });

    let entries = await addressBook.getEntries();

    expect(entries).toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
      {
        id: expect.any(String),
        address: walletAccounts[1].btcAddresses.taproot.address,
        name: 'Bob',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);

    await addressBook.clear();

    entries = await addressBook.getEntries();

    expect(entries).toEqual([]);
  });

  it('should be able to add same entries to different networks if valid', async () => {
    const addressBookTestnet = new AddressBook(masterVault, 'Testnet4');
    const addressBookSignet = new AddressBook(masterVault, 'Signet');

    await addressBookTestnet.addEntry({
      address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
      name: 'Alice',
    });
    await addressBookSignet.addEntry({
      address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
      name: 'Alice',
    });

    expect(addressBookTestnet.getEntries()).resolves.toEqual([
      {
        id: expect.any(String),
        address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);
    expect(addressBookSignet.getEntries()).resolves.toEqual([
      {
        id: expect.any(String),
        address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);
  });

  it('clearing one network leaves others intact', async () => {
    const addressBookMainnet = new AddressBook(masterVault, 'Mainnet');
    const addressBookSignet = new AddressBook(masterVault, 'Signet');

    await addressBookMainnet.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });
    await addressBookSignet.addEntry({
      address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
      name: 'Alice',
    });

    expect(addressBookMainnet.getEntries()).resolves.toEqual([
      {
        id: expect.any(String),
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);
    expect(addressBookSignet.getEntries()).resolves.toEqual([
      {
        id: expect.any(String),
        address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);

    await addressBookMainnet.clear();

    expect(addressBookMainnet.getEntries()).resolves.toEqual([]);
    expect(addressBookSignet.getEntries()).resolves.toEqual([
      {
        id: expect.any(String),
        address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
        name: 'Alice',
        chain: 'bitcoin',
        unixDateAdded: expect.any(Number),
      },
    ]);
  });

  it('should throw on adding an empty address', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    await expect(() =>
      addressBook.addEntry({
        address: '',
        name: 'Alice',
      }),
    ).rejects.toThrowCoreError('addEntry: Invalid address', ErrorCodes.InvalidAddress);
  });

  it('should throw on adding an invalid address', async () => {
    const addressBookTestnet = new AddressBook(masterVault, 'Testnet4');

    // adding mainnet address for testnet
    await expect(() =>
      addressBookTestnet.addEntry({
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Alice',
      }),
    ).rejects.toThrowCoreError('addEntry: Invalid address', ErrorCodes.InvalidAddress);

    // adding mainnet stacks address
    await expect(() =>
      addressBookTestnet.addEntry({
        address: walletAccounts[0].stxAddress,
        name: 'Alice',
      }),
    ).rejects.toThrowCoreError('addEntry: Invalid address', ErrorCodes.InvalidAddress);

    // adding random address
    await expect(() =>
      addressBookTestnet.addEntry({
        address: 'random',
        name: 'Alice',
      }),
    ).rejects.toThrowCoreError('addEntry: Invalid address', ErrorCodes.InvalidAddress);

    const addressBookMainnet = new AddressBook(masterVault, 'Mainnet');

    // adding testnet address for mainnet
    await expect(() =>
      addressBookMainnet.addEntry({
        address: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
        name: 'Alice',
      }),
    ).rejects.toThrowCoreError('addEntry: Invalid address', ErrorCodes.InvalidAddress);
  });

  it('should throw on adding an existing address', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });

    await expect(() =>
      addressBook.addEntry({
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: 'Bob',
      }),
    ).rejects.toThrowCoreError('addEntry: An entry with this address already exists', ErrorCodes.AddressAlreadyExists);
  });

  it('should throw on adding an empty name', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    await expect(() =>
      addressBook.addEntry({
        address: walletAccounts[0].btcAddresses.taproot.address,
        name: '   ',
      }),
    ).rejects.toThrowCoreError('Name cannot be empty', ErrorCodes.InvalidName);
  });

  it('should throw on adding an existing name', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });

    await expect(() =>
      addressBook.addEntry({
        address: walletAccounts[1].btcAddresses.taproot.address,
        name: 'Alice',
      }),
    ).rejects.toThrowCoreError('addEntry: An entry with this name already exists', ErrorCodes.NameAlreadyExists);
  });

  it('should throw on renaming a non-existent address', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });

    await expect(() => addressBook.editEntry('invalidId', { name: 'Bob' })).rejects.toThrowCoreError(
      'editEntry: Could not find entry to update',
      ErrorCodes.EntryNotFound,
    );
  });

  it('should throw on renaming with an empty name', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    const entryId = await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });

    await expect(() => addressBook.editEntry(entryId, { name: '  ' })).rejects.toThrowCoreError(
      'Name cannot be empty',
      ErrorCodes.InvalidName,
    );
  });

  it('should throw on renaming to name with name clash', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    const entryId = await addressBook.addEntry({
      address: walletAccounts[0].btcAddresses.taproot.address,
      name: 'Alice',
    });
    await addressBook.addEntry({
      address: walletAccounts[1].btcAddresses.taproot.address,
      name: 'Bob',
    });

    await expect(() => addressBook.editEntry(entryId, { name: 'Bob' })).rejects.toThrowCoreError(
      'editEntry: An entry with this name already exists',
      ErrorCodes.NameAlreadyExists,
    );
  });

  it('should get correct address data', async () => {
    const addressBook = new AddressBook(masterVault, 'Mainnet');

    expect(addressBook.getAddressDetails(walletAccounts[0].btcAddresses.taproot.address)).toEqual({
      isValid: true,
      chain: 'bitcoin',
      validatedAddress: walletAccounts[0].btcAddresses.taproot.address,
    });
    expect(addressBook.getAddressDetails(walletAccounts[0].btcAddresses.nested!.address)).toEqual({
      isValid: true,
      chain: 'bitcoin',
      validatedAddress: walletAccounts[0].btcAddresses.nested!.address,
    });
    expect(addressBook.getAddressDetails(walletAccounts[0].btcAddresses.native!.address)).toEqual({
      isValid: true,
      chain: 'bitcoin',
      validatedAddress: walletAccounts[0].btcAddresses.native!.address,
    });
    expect(addressBook.getAddressDetails(walletAccounts[0].stxAddress)).toEqual({
      isValid: true,
      chain: 'stacks',
      validatedAddress: walletAccounts[0].stxAddress,
    });

    expect(addressBook.getAddressDetails('invalid')).toEqual({
      isValid: false,
    });

    const addressBookTestnet = new AddressBook(masterVault, 'Testnet');
    expect(addressBookTestnet.getAddressDetails(walletAccounts[0].btcAddresses.taproot.address)).toEqual({
      isValid: false,
    });
    expect(addressBookTestnet.getAddressDetails(walletAccounts[0].btcAddresses.nested!.address)).toEqual({
      isValid: false,
    });
    expect(addressBookTestnet.getAddressDetails(walletAccounts[0].btcAddresses.native!.address)).toEqual({
      isValid: false,
    });
    expect(addressBookTestnet.getAddressDetails(walletAccounts[0].stxAddress)).toEqual({
      isValid: false,
    });
    expect(addressBookTestnet.getAddressDetails('tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj')).toEqual({
      isValid: true,
      chain: 'bitcoin',
      validatedAddress: 'tb1qjudrq5ug6m4pv9ugur6hmay7j3l6vr3tdqdqdj',
    });
  });
});
