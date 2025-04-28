export const erc20Abi = [
  {
    name: 'core::integer::u256',
    type: 'struct',
    members: [
      {
        name: 'low',
        type: 'core::integer::u128',
      },
      {
        name: 'high',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    name: 'ERC20Impl',
    type: 'impl',
    interface_name: 'openzeppelin::token::erc20::interface::IERC20',
  },
  {
    name: 'openzeppelin::token::erc20::interface::IERC20',
    type: 'interface',
    items: [
      {
        name: 'name',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'symbol',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'decimals',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u8',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'total_supply',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'balance_of',
        type: 'function',
        inputs: [
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'allowance',
        type: 'function',
        inputs: [
          {
            name: 'owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'spender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          {
            name: 'recipient',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'external',
      },
      {
        name: 'transfer_from',
        type: 'function',
        inputs: [
          {
            name: 'sender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'recipient',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'external',
      },
      {
        name: 'approve',
        type: 'function',
        inputs: [
          {
            name: 'spender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'external',
      },
    ],
  },
  {
    name: 'ERC20CamelOnlyImpl',
    type: 'impl',
    interface_name: 'openzeppelin::token::erc20::interface::IERC20CamelOnly',
  },
  {
    name: 'openzeppelin::token::erc20::interface::IERC20CamelOnly',
    type: 'interface',
    items: [
      {
        name: 'totalSupply',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'balanceOf',
        type: 'function',
        inputs: [
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'transferFrom',
        type: 'function',
        inputs: [
          {
            name: 'sender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'recipient',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'external',
      },
    ],
  },
  {
    name: 'constructor',
    type: 'constructor',
    inputs: [
      {
        name: 'name',
        type: 'core::felt252',
      },
      {
        name: 'symbol',
        type: 'core::felt252',
      },
      {
        name: 'decimals',
        type: 'core::integer::u8',
      },
      {
        name: 'initial_supply',
        type: 'core::integer::u256',
      },
      {
        name: 'recipient',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'permitted_minter',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'provisional_governance_admin',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'upgrade_delay',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    name: 'increase_allowance',
    type: 'function',
    inputs: [
      {
        name: 'spender',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'added_value',
        type: 'core::integer::u256',
      },
    ],
    outputs: [
      {
        type: 'core::bool',
      },
    ],
    state_mutability: 'external',
  },
  {
    name: 'decrease_allowance',
    type: 'function',
    inputs: [
      {
        name: 'spender',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'subtracted_value',
        type: 'core::integer::u256',
      },
    ],
    outputs: [
      {
        type: 'core::bool',
      },
    ],
    state_mutability: 'external',
  },
  {
    name: 'increaseAllowance',
    type: 'function',
    inputs: [
      {
        name: 'spender',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'addedValue',
        type: 'core::integer::u256',
      },
    ],
    outputs: [
      {
        type: 'core::bool',
      },
    ],
    state_mutability: 'external',
  },
  {
    name: 'decreaseAllowance',
    type: 'function',
    inputs: [
      {
        name: 'spender',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'subtractedValue',
        type: 'core::integer::u256',
      },
    ],
    outputs: [
      {
        type: 'core::bool',
      },
    ],
    state_mutability: 'external',
  },
] as const;
