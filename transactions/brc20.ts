import { base64 } from '@scure/base';
import { NetworkType } from 'types';
import { createInscriptionRequest } from '../api';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import xverseInscribeApi from '../api/xverseInscribe';

const createTransferInscriptionContent = (token: string, amount: string) => ({
  p: 'brc-20',
  op: 'transfer',
  tick: token,
  amt: amount,
});

const btcClient = new BitcoinEsploraApiProvider({
  network: 'Mainnet',
});

export const createBrc20TransferOrder = async (token: string, amount: string, recipientAddress: string) => {
  const transferInscriptionContent = createTransferInscriptionContent(token, amount);
  const contentB64 = base64.encode(Buffer.from(JSON.stringify(transferInscriptionContent)));
  const contentSize = Buffer.from(JSON.stringify(transferInscriptionContent)).length;
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

export const brc20TransferEstimateFees = async (
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
) => {
  const { chainFee, serviceFee, inscriptionValue, vSize } = await xverseInscribeApi.getBrc20TransferFees(
    tick,
    amount,
    revealAddress,
    feeRate,
  );
  return { chainFee, serviceFee, inscriptionValue, vSize };
};

export const Brc20TransferCreateOrder = async (
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
  network: NetworkType,
) => {
  const { commitAddress, commitValue, commitValueBreakdown } = await xverseInscribeApi.createBrc20TransferOrder(
    tick,
    amount,
    revealAddress,
    feeRate,
    network,
  );
  return { commitAddress, commitValue, commitValueBreakdown };
};

export const Brc20TransferExecuteOrder = async (commitAddress: string, commitTransactionHex: string) => {
  const { revealTransactionId, revealUTXOVOut, revealUTXOValue } = await xverseInscribeApi.executeBrc20TransferOrder(
    commitAddress,
    commitTransactionHex,
  );
  return { revealTransactionId, revealUTXOVOut, revealUTXOValue };
};
