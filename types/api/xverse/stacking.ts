import BigNumber from 'bignumber.js';
import { CoreInfo } from '../stacks/assets';

export interface Pool {
  address: string;
  contract: string;
  contract_version: number;
  reward_address: string;
  starting_cycle: number;
  cycle_duration: number;
  available_cycle_durations: number[];
  minimum: string;
  fee_percent: number;
  estimated_yield: number;
}

export interface StackingPoolInfo {
  open: boolean;
  enrollment_closing_blocks: number;
  enrollment_open_blocks: number;
  pools: Array<Pool>;
  pool_total: string;
  pox: {
    contract_id: string;
    first_burnchain_block_height: number;
    min_amount_ustx: string;
    prepare_cycle_length: number;
    rejection_fraction: number;
    reward_cycle_id: number;
    reward_cycle_length: number;
    rejection_votes_left_required: string;
    total_liquid_supply_ustx: string;
    next_reward_cycle_in: number;
  };
}

export interface StackerInfo {
  stacked: boolean;
  pool_total?: string;
  amount: string;
  reward_share_pct?: string;
  first_reward_cycle: number;
  lock_period: number;
  pool_pox_address: string;
  user_pox_address: string;
  poolContractName?: string;
}

export interface DelegationInfo {
  delegated: boolean;
  amount?: string;
  delegatedTo?: string;
  untilBurnHeight?: number;
}

export interface CurrentPoolReward {
  currentCyclePoolRewardInBtc: string;
  currentCyclePoolRewardInCurrency: string;
}

export interface StackingData {
  poolInfo: StackingPoolInfo;
  delegationInfo: DelegationInfo;
  coreInfo: CoreInfo;
  stackerInfo?: StackerInfo;
  currentPoolReward?: CurrentPoolReward;
}

export interface StackingStateData {
  delegated: boolean;
  txid: string;
  amount: BigNumber;
  startingCycle: number;
  duration: number;
  poolContractAddress: string;
  poolContractName: string;
  revoked: boolean;
}
