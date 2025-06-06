import { validateStacksAddress } from '@stacks/transactions';
import { Mutex } from 'async-mutex';
import { validate, Network as ValidationNetwork } from 'bitcoin-address-validation';
import { NetworkType } from '../types';
import { CoreError } from '../utils/coreError';
import { keyValueVaultKeys, MasterVault } from '../vaults';
import { ErrorCodes } from './errors';
import { AddressBookEntry, AddressBookEntryChain } from './types';

const MAX_NAME_LENGTH = 20;

type VaultData = {
  addresses: AddressBookEntry[];
};

export class AddressBook {
  private vault: MasterVault;

  private network: NetworkType;

  private saveMutex = new Mutex();

  constructor(vault: MasterVault, network: NetworkType) {
    this.vault = vault;
    this.network = network;
  }

  private getValidatedStxAddress = (address: string): string => {
    const validateAddress = address.trimStart().trimEnd();

    if (validateAddress.length === 0) {
      throw new CoreError('Address cannot be empty', ErrorCodes.InvalidAddress);
    }

    if (!validateStacksAddress(validateAddress)) {
      throw new CoreError('Address is invalid', ErrorCodes.InvalidAddress);
    }

    const stxAddressPrefix = this.network === 'Mainnet' ? 'SP' : 'ST';
    if (!validateAddress.startsWith(stxAddressPrefix)) {
      throw new CoreError('Address is invalid for network', ErrorCodes.InvalidAddress);
    }

    return validateAddress;
  };

  private getValidatedBtcAddress = (address: string): string => {
    const validateAddress = address.trimStart().trimEnd();

    if (validateAddress.length === 0) {
      throw new CoreError('Address cannot be empty', ErrorCodes.InvalidAddress);
    }

    const validationNetwork =
      this.network === 'Mainnet'
        ? ValidationNetwork.mainnet
        : this.network === 'Regtest'
        ? ValidationNetwork.regtest
        : ValidationNetwork.testnet;

    if (!validate(validateAddress, validationNetwork)) {
      throw new CoreError('Address is invalid', ErrorCodes.InvalidAddress);
    }

    return validateAddress;
  };

  private getValidatedName = (name: string): string => {
    const validateName = name.trimStart().trimEnd();
    const validCharRegex = /^[a-zA-Z0-9 ]*$/;

    if (validateName.length === 0) {
      throw new CoreError('Name cannot be empty', ErrorCodes.InvalidName);
    }

    if (validateName.length > MAX_NAME_LENGTH) {
      throw new CoreError(`Name cannot be longer than ${MAX_NAME_LENGTH} characters`, ErrorCodes.NameTooLong);
    }

    if (!validCharRegex.test(validateName)) {
      throw new CoreError('Name can only contain alphanumeric characters and spaces', ErrorCodes.ProhibitedSymbols);
    }

    return validateName;
  };

  private getVaultData = async (): Promise<VaultData> => {
    const vaultData = await this.vault.KeyValueVault.get<VaultData>(keyValueVaultKeys.addressBook(this.network));

    if (!vaultData) {
      return {
        addresses: [],
      };
    }

    return vaultData;
  };

  private setVaultData = async (newValues: VaultData) => {
    await this.vault.KeyValueVault.set(keyValueVaultKeys.addressBook(this.network), newValues);
  };

  getAddressDetails = (
    address: string,
  ):
    | { isValid: false; chain?: undefined; validatedAddress?: undefined }
    | { isValid: true; chain: AddressBookEntryChain; validatedAddress: string } => {
    const chainChecks = [
      { chain: 'stacks' as const, checkFunction: this.getValidatedStxAddress },
      { chain: 'bitcoin' as const, checkFunction: this.getValidatedBtcAddress },
    ];

    for (const { chain, checkFunction } of chainChecks) {
      try {
        const validatedAddress = checkFunction(address);
        return { isValid: true, chain, validatedAddress };
      } catch (error) {
        if (error instanceof CoreError && error.code === ErrorCodes.InvalidAddress) {
          continue;
        }
        throw error;
      }
    }

    return { isValid: false };
  };

  getEntries = async (): Promise<AddressBookEntry[]> => {
    const vaultData = await this.getVaultData();
    return vaultData.addresses;
  };

  getEntry = async (id: string): Promise<AddressBookEntry | undefined> => {
    const entries = await this.getEntries();
    return entries.find((entry) => entry.id === id);
  };

  addEntry = async (newEntry: { address: string; name: string }): Promise<string> => {
    const { address, name } = newEntry;
    const validatedName = this.getValidatedName(name);

    const { isValid, chain, validatedAddress } = this.getAddressDetails(address);

    if (!isValid) {
      throw new CoreError('addEntry: Invalid address', ErrorCodes.InvalidAddress);
    }

    const release = await this.saveMutex.acquire();

    try {
      const vaultData = await this.getVaultData();

      const existingAddress = vaultData.addresses.find((entry) => entry.address === validatedAddress);
      if (existingAddress) {
        throw new CoreError('addEntry: An entry with this address already exists', ErrorCodes.AddressAlreadyExists);
      }

      const existingName = vaultData.addresses.find((entry) => entry.name === validatedName);
      if (existingName) {
        throw new CoreError('addEntry: An entry with this name already exists', ErrorCodes.NameAlreadyExists);
      }

      const newId = crypto.randomUUID();
      vaultData.addresses.push({
        id: newId,
        address: validatedAddress,
        name: validatedName,
        chain,
        unixDateAdded: Date.now(),
      });
      await this.setVaultData(vaultData);

      return newId;
    } finally {
      release();
    }
  };

  editEntry = async (id: string, updates: { address?: string; name?: string }): Promise<void> => {
    const release = await this.saveMutex.acquire();

    try {
      const vaultData = await this.getVaultData();

      const existingEntry = vaultData.addresses.find((entry) => entry.id === id);
      if (!existingEntry) {
        throw new CoreError('editEntry: Could not find entry to update', ErrorCodes.EntryNotFound);
      }

      const validatedName = updates.name !== undefined ? this.getValidatedName(updates.name) : undefined;

      let validatedAddress: string | undefined = undefined;
      let chain: AddressBookEntryChain | undefined = undefined;
      if (updates.address) {
        const {
          isValid,
          chain: derivedChain,
          validatedAddress: derivedAddress,
        } = this.getAddressDetails(updates.address);

        if (!isValid) {
          throw new CoreError('addEntry: Invalid address', ErrorCodes.InvalidAddress);
        }

        chain = derivedChain;
        validatedAddress = derivedAddress;
      }

      const existingAddress =
        validatedAddress && vaultData.addresses.find((entry) => entry.id !== id && entry.address === validatedAddress);
      if (existingAddress) {
        throw new CoreError('editEntry: An entry with this address already exists', ErrorCodes.AddressAlreadyExists);
      }

      const existingName =
        validatedName && vaultData.addresses.find((entry) => entry.id !== id && entry.name === validatedName);
      if (existingName) {
        throw new CoreError('editEntry: An entry with this name already exists', ErrorCodes.NameAlreadyExists);
      }

      const newVaultAddresses = vaultData.addresses.map((entry) => {
        if (entry.id === id) {
          return {
            ...entry,
            name: validatedName || entry.name,
            address: validatedAddress || entry.address,
            chain: chain || entry.chain,
          };
        }
        return entry;
      });

      await this.setVaultData({
        ...vaultData,
        addresses: newVaultAddresses,
      });
    } finally {
      release();
    }
  };

  removeEntry = async (id: string): Promise<void> => {
    const release = await this.saveMutex.acquire();

    try {
      const vaultData = await this.getVaultData();

      const newVaultAddresses = vaultData.addresses.filter((entry) => entry.id !== id);

      await this.setVaultData({
        ...vaultData,
        addresses: newVaultAddresses,
      });
    } finally {
      release();
    }
  };

  clear = async (): Promise<void> => {
    await this.vault.KeyValueVault.remove(keyValueVaultKeys.addressBook(this.network));
  };
}
