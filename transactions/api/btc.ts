export async function fetchBtcAddressUnspent(
    btcAddress: string,
    network: Network,
  ): Promise<Array<BtcUtxoDataResponse>> {
    const btcApiBaseUrl = 'https://api.blockcypher.com/v1/btc/main/addrs/';
    const btcApiBaseUrlTestnet =
      'https://api.blockcypher.com/v1/btc/test3/addrs/';
    let apiUrl = `${btcApiBaseUrl}${btcAddress}/?unspentOnly=true&limit=50`;
    if (network === 'Testnet') {
      apiUrl = `${btcApiBaseUrlTestnet}${btcAddress}/?unspentOnly=true&limit=50`;
    }
    return axios
      .get<BtcAddressDataResponse>(apiUrl, {timeout: 45000})
      .then((response) => {
        const confirmed = response.data.txrefs
          ? (response.data.txrefs as Array<BtcUtxoDataResponse>)
          : [];
        const unconfirmed = response.data.unconfirmed_txrefs
          ? (response.data.unconfirmed_txrefs as Array<BtcUtxoDataResponse>)
          : [];
        const combined = [...confirmed, ...unconfirmed];
        return combined;
      });
  }
  
  export async function fetchPoolBtcAddressBalance(
    btcAddress: string,
    network: Network,
  ): Promise<BtcBalance> {
    const btcApiBaseUrl = 'https://api.blockcypher.com/v1/btc/main/addrs/';
    const btcApiBaseUrlTestnet =
      'https://api.blockcypher.com/v1/btc/test3/addrs/';
    let apiUrl = `${btcApiBaseUrl}${btcAddress}`;
    if (network === 'Testnet') {
      apiUrl = `${btcApiBaseUrlTestnet}${btcAddress}`;
    }
    return axios
      .get<BtcAddressDataResponse>(apiUrl, {timeout: 45000})
      .then((response) => {
        const btcPoolData: BtcBalance = {
          balance: response.data.final_balance,
        };
        return btcPoolData;
      });
  }
  
  export async function broadcastRawBtcTransaction(
    rawTx: string,
    network: Network,
  ): Promise<BtcTransactionBroadcastResponse> {
    const btcApiBaseUrl = 'https://api.blockcypher.com/v1/btc/main/txs/push';
    const btcApiBaseUrlTestnet =
      'https://api.blockcypher.com/v1/btc/test3/txs/push';
    let apiUrl = btcApiBaseUrl;
    if (network === 'Testnet') {
      apiUrl = btcApiBaseUrlTestnet;
    }
  
    const data = {
      tx: rawTx,
    };
  
    return axios
      .post<BtcTransactionBroadcastResponse>(apiUrl, data, {timeout: 45000})
      .then((response) => {
        return response.data;
      });
  }