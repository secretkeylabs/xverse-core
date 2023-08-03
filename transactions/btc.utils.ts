import { hex } from '@scure/base';
import BigNumber from 'bignumber.js';
import { UTXO } from '../types';
import type { Recipient, TransactionUtxoSelectionMetadata } from './btc';
import { createTransaction } from './btc';

// these are conservative estimates
const ESTIMATED_VBYTES_PER_OUTPUT = 45; // actually around 50
const ESTIMATED_VBYTES_PER_INPUT = 85; // actually around 89 or 90
const BITCOIN_DUST_VALUE = 1000;

function buildTransactionAndGetMetadata(props: {
  recipients: Recipient[];
  selectedUtxos: UTXO[];
  changeAddress: string;
  feeRate: number;
  privateKey: string;
  recipientTotal: BigNumber;
  withChange: boolean;
}): TransactionUtxoSelectionMetadata | undefined {
  const { privateKey, selectedUtxos, recipientTotal, recipients, changeAddress, feeRate, withChange } = props;
  // try transaction with change
  const tx = createTransaction(
    privateKey,
    selectedUtxos,
    recipientTotal,
    recipients,
    changeAddress,
    'Mainnet',
    !withChange,
  );

  tx.sign(hex.decode(privateKey));
  tx.finalize();

  const txSize = tx.vsize;
  let sentSats = new BigNumber(0);

  for (let i = 0; i < tx.outputsLength; i++) {
    const output = tx.getOutput(i);
    sentSats = sentSats.plus(new BigNumber((output.amount ?? 0n).toString()));
  }

  let change: BigNumber, fee: BigNumber, isValid: boolean;
  if (withChange) {
    fee = new BigNumber(txSize).times(feeRate);
    change = sentSats.minus(recipientTotal).minus(fee);
    isValid = change.gt(BITCOIN_DUST_VALUE);
  } else {
    const inputSum = selectedUtxos.reduce<BigNumber>((sum, utxo) => sum.plus(utxo.value), new BigNumber(0));

    change = new BigNumber(0);
    fee = inputSum.minus(sentSats);
    isValid = fee.div(txSize).gt(feeRate);
  }

  // check if there is change and if the change is greater than the vsize*feeRate + dust rate
  if (isValid) {
    return {
      selectedUtxos,
      fee: fee.toNumber(),
      feeRate,
      change: change.toNumber(),
    };
  }
}

export function getTransactionMetadataForUtxos(
  recipients: Recipient[],
  selectedUtxos: UTXO[],
  changeAddress: string,
  feeRate: number,
): TransactionUtxoSelectionMetadata | undefined {
  const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';

  const inputSum = selectedUtxos.reduce<BigNumber>((sum, utxo) => sum.plus(utxo.value), new BigNumber(0));
  const recipientTotal = recipients.reduce<BigNumber>(
    (sum, recipient) => sum.plus(recipient.amountSats),
    new BigNumber(0),
  );

  const estimatedFees = new BigNumber(feeRate).times(
    ESTIMATED_VBYTES_PER_OUTPUT * recipients.length + ESTIMATED_VBYTES_PER_INPUT * selectedUtxos.length,
  );
  // ensure that the UTXOs can cover the expected outputs
  if (!inputSum.gt(recipientTotal.plus(estimatedFees))) return undefined;

  // We first try the transaction with change because if there is change with the
  // desired fee rate, then we want to return it to the user
  const metaDataWithChange = buildTransactionAndGetMetadata({
    recipients,
    selectedUtxos,
    changeAddress,
    feeRate,
    privateKey: dummyPrivateKey,
    recipientTotal,
    withChange: true,
  });

  if (metaDataWithChange) return metaDataWithChange;

  // the attempt with change above could've resulted in a change that is just below dust, or removing the change output
  // could bring the fees low enough to get to the desired fee rate, so we try it again without change
  const metaDataWithoutChange = buildTransactionAndGetMetadata({
    recipients,
    selectedUtxos,
    changeAddress,
    feeRate,
    privateKey: dummyPrivateKey,
    recipientTotal,
    withChange: false,
  });

  return metaDataWithoutChange;
}

type SelectOptimalUtxosProps = {
  recipients: Recipient[];
  selectedUtxos: UTXO[];
  availableUtxos: UTXO[];
  changeAddress: string;
  feeRate: number;
  currentBestUtxoCount?: number;
};
export function selectOptimalUtxos({
  recipients,
  selectedUtxos,
  availableUtxos,
  changeAddress,
  feeRate,
  currentBestUtxoCount,
}: SelectOptimalUtxosProps): TransactionUtxoSelectionMetadata | undefined {
  const currentSelectionData = getTransactionMetadataForUtxos(recipients, selectedUtxos, changeAddress, feeRate);

  // if there is a valid selection, adding more UTXOs would only make the fees higher, so just return
  if (currentSelectionData) return currentSelectionData;

  // if we have a current best selection, we want to check if adding another UTXO would make the fees higher
  // and skip if it does since it would be a worse selection
  const wouldIncreaseFees = currentBestUtxoCount === selectedUtxos.length - 1;

  if (availableUtxos.length === 0 || wouldIncreaseFees) {
    // we either have no more UTXOs to add or adding would make an existing outer selection worse, so we bail
    return undefined;
  }

  // sort smallest to biggest so we can pop biggest from end
  const sortedUtxos = [...availableUtxos];
  sortedUtxos.sort((a, b) => a.value - b.value);

  let bestSelectionData: TransactionUtxoSelectionMetadata | undefined;
  while (sortedUtxos.length > 0) {
    // We know at this point that the sortedUtxos array has a value, so we can safely pop and type to a UTXO
    const utxo = sortedUtxos.pop() as UTXO;

    const nextSelectionData = selectOptimalUtxos({
      recipients,
      selectedUtxos: [...selectedUtxos, utxo],
      availableUtxos: sortedUtxos,
      changeAddress,
      feeRate,
      currentBestUtxoCount: currentBestUtxoCount ?? bestSelectionData?.selectedUtxos.length,
    });

    if (!nextSelectionData) return bestSelectionData;

    /**
     * we want to:
     * - minimise fees
     * - have zero change or maximise change
     * - while staying above the selected fee rate
     **/
    if (!bestSelectionData) {
      bestSelectionData = nextSelectionData;
    } else if (bestSelectionData.fee > nextSelectionData.fee) {
      bestSelectionData = nextSelectionData;
    } else if (nextSelectionData.fee === bestSelectionData.fee) {
      if (bestSelectionData.change < nextSelectionData.change) {
        bestSelectionData = nextSelectionData;
      }
    } else {
      return bestSelectionData;
    }
  }

  return bestSelectionData;
}
