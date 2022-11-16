export type TransactionType =
  | 'token_transfer'
  | 'contract_call'
  | 'smart_contract'
  | 'coinbase'
  | 'poison_microblock'
  | 'bitcoin'
  | 'unsupported';

export type TransactionStatus = 'pending' | 'success' | 'invalid';

export type TokenType = 'fungible' | 'non_fungible';

export type ContractCallType =
  | 'delegate-stx'
  | 'allow-contract-caller'
  | 'revoke-delegate-stx'
  | 'send-many'
  | 'transfer';

export interface FunctionArg {
  hex: string;
  repr: string;
  name: string;
  type: string;
}

export type AssetPostCondition = {
  contract_name: string;
  asset_name: string;
  contract_address: string;
};

export type TransactionPostCondition = {
  type: TokenType;
  condition_code: string;
  amount: string;
  principal: {
    type_id: string;
    address: string;
  };
  asset: AssetPostCondition;
  asset_value?: { hex: string; repr: string };
};

export interface ContractCall {
  contract_id: string;
  function_name: ContractCallType;
  function_signature: string;
  function_args: FunctionArg[];
}
