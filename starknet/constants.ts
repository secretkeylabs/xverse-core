// https://github.com/argentlabs/argent-contracts-starknet/blob/main/deployments/account.txt

import { constants } from 'starknet';

// The account contract can be recompiled for cheaper gas (Cairo Native).
// Argent hasn't done so yet, on 17th April the ETA on their side was 3+ months out
// eslint-disable-next-line @typescript-eslint/naming-convention
export const argentXContractClassHashV0_4_0 = '0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f';

// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
export const starknetCoinType = "9004'";

export const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

export const networkNameToApi: Record<constants.NetworkName, string> = {
  [constants.NetworkName.SN_MAIN]: 'https://free-rpc.nethermind.io/mainnet-juno/v0_8', // api-3.xverse.app/starknet/rpc
  [constants.NetworkName.SN_SEPOLIA]: 'https://free-rpc.nethermind.io/sepolia-juno/v0_8',
};
