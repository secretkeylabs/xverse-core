import { base64 } from '@scure/base';
import { createInscriptionRequest, estimateInscriptionFee, uploadInscriptionFile } from '../api';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';

const createTransferInscriptionContent = (token: string, amount: string) =>
  ({
    p: 'brc-20',
    op: 'transfer',
    tick: token,
    amt: amount,
  });

const btcClient = new BitcoinEsploraApiProvider({
    network: 'Mainnet',
})

export const createBrc20TransferOrder = async (
  token: string,
  amount: string,
  recipientAddress: string,
) => {
  const transferInscriptionContent = createTransferInscriptionContent(token, amount);
  const contentB64 = base64.encode(Buffer.from(JSON.stringify(transferInscriptionContent)));
  const contentSize = Buffer.from(JSON.stringify(transferInscriptionContent)).length
  const feesResponse = await btcClient.getRecommendedFees();
  const inscriptionRequest = await createInscriptionRequest(
    recipientAddress,
    contentSize,
    feesResponse.fastestFee,
    contentB64,
    token,
    amount,
  );

  return {
    inscriptionRequest,
    feesResponse,
  };
};
