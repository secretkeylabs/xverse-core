import { Contract, RpcProvider } from 'starknet';
import { networkNameToApi } from '../constants';
import { erc20Abi } from './erc20';

interface BalanceOfArgs {
  tokenAddress: string;
  address: string;
}

// STRK tokenAddress: 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
export async function balanceOf({ tokenAddress, address }: BalanceOfArgs): Promise<bigint | number> {
  const providerClient = new RpcProvider({
    nodeUrl: networkNameToApi.SN_MAIN,
  });

  const erc20Contract = new Contract(erc20Abi, tokenAddress, providerClient).typedv2(erc20Abi);

  const balance = await erc20Contract.balance_of(address);

  if (typeof balance === 'bigint' || typeof balance === 'number') {
    return balance;
  } else {
    // Uint256 typing is I believe wrong. But if it isn't, it's a programming error; fail fast.
    throw new Error(`Unexpected balance type received: ${typeof balance}. Expected bigint or number.`);
  }
}
