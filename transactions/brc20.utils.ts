import xverseInscribeApi from '../api/xverseInscribe';

export const tryFinaliseTransferWithBackOff = async (commitAddress: string, transferTransactionHex: string) => {
  const MAX_RETRIES = 5;
  let error: Error | undefined;

  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const response = await xverseInscribeApi.finalizeBrc20TransferOrder(commitAddress, transferTransactionHex);

      return response;
    } catch (err) {
      error = err as Error;
    }
    // we do exponential back-off here to give the reveal transaction time to propagate
    // sleep times are 500ms, 1000ms, 2000ms, 4000ms, 8000ms
    // eslint-disable-next-line @typescript-eslint/no-loop-func -- exponential back-off sleep between retries
    await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, i)));
  }

  throw error!;
};
