export async function getTransaction(txid: string, network: SettingsNetwork): Promise<Transaction> {
  return fetch(`${network.address}/extended/v1/tx/${txid}`, {
    method: 'GET',
  })
    .then((response) => response.json())
    .then((response) => {
      return response;
    });
}
