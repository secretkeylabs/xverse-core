# "Account" terminology

BIP44 defines the concept of an "account", with each account supporting multiple addresses. In Starknet, users initialize a Starknet account by deploying a contract to a predefiend address, with each account having only a single address.

To integrate Starknet accounts into the account environment of the Xverse Wallet, the utilities in this module generate each Starkent account using the Wallet's best available index applied to the derivation path's account level:

- `m/44'/9004'/<best-available-index>/0/0`,

For newer accounts, the best available index is the account index. For legacy accounts, the best available index is the address index. Users will have the exact same Starknet addresses at the same account index if they ever migrate from a legacy wallet to a newer wallet without having to transfer their funds.

Throughout this module, the term "account" is usually used to refer to a Starknet account.
