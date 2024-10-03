import { SingleSigSpendingCondition, createMessageSignature, deserializeTransaction } from '@stacks/transactions';

export function addSignatureToStxTransaction(transaction: string | Buffer, signatureVRS: Buffer) {
  const deserializedTx = deserializeTransaction(transaction);
  const spendingCondition = createMessageSignature(signatureVRS.toString('hex'));
  (deserializedTx.auth.spendingCondition as SingleSigSpendingCondition).signature = spendingCondition;
  return deserializedTx;
}
