import { StacksNetwork } from '@stacks/network';
import { fetchCoinMetaData } from '../api';
import { supportedCoins } from '../constant';
import { Coin, CoinMetaData, CoinsResponse } from '../types/index';

export async function getCoinMetaData(
  contractIds: string[],
  network: StacksNetwork
): Promise<CoinsResponse> {
  const coinMetaDataList = contractIds.map(async (contract) => {
    const response: CoinMetaData | undefined = await fetchCoinMetaData(contract, network);
    let coin: Coin;
    if (!response) {
      coin = {
        name: contract.substring(contract.indexOf('.') + 1),
        contract: contract,
        supported: false,
      };
    } else {
      coin = {
        name: response.name,
        contract: contract,
        ticker: response.symbol,
        description: response.description,
        image: response.image_canonical_uri,
        decimals: response.decimals,
        supported: false,
      };
      if (coin.name === '') coin.name = contract.substring(coin.contract.indexOf('.') + 1);
    }
    const isSupported = supportedCoins.find(
      (supportedCoin) => supportedCoin.contract === coin.contract
    );
    if (isSupported) {
      coin.supported = true;
      coin.name = isSupported.name;
    }
    return coin;
  });
  return Promise.all(coinMetaDataList);
}
