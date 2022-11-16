import BigNumber from 'bignumber.js';
import {
  Input,
  Output,
  BtcTransactionData,
  BtcTransactionDataResponse,
} from 'types';

export function sumOutputsForAddress(
  outputs: Output[],
  address: string,
): number {
  var total = 0;
  outputs.forEach((output) => {
    if (output.addresses) {
      if (output.addresses.indexOf(address) !== -1) {
        total += output.value;
      }
    }
  });
  return total;
}

export function sumInputsForAddress(inputs: Input[], address: string): number {
  var total = 0;
  inputs.forEach((input) => {
    if (input.addresses.indexOf(address) !== -1) {
      total += input.output_value;
    }
  });
  return total;
}

export function parseBtcTransactionData(
  responseTx: BtcTransactionDataResponse,
  btcAddress: string,
): BtcTransactionData {
  const inputAddresses: string[] = [];
  responseTx.inputs.forEach((input) => {
    if (input.addresses !== null) {
      if (input.addresses.length > 0) {
        inputAddresses.push(input.addresses[0]);
      }
    }
  });

  const inputAddressSet = new Set(inputAddresses);
  const incoming = !inputAddressSet.has(btcAddress);

  // calculate sent/received amount from inputs/outputs
  var amount = 0;
  if (incoming) {
    amount = sumOutputsForAddress(responseTx.outputs, btcAddress);
  } else {
    const inputAmount = sumInputsForAddress(responseTx.inputs, btcAddress);
    const changeAmount = sumOutputsForAddress(responseTx.outputs, btcAddress);
    amount = inputAmount - changeAmount;
  }

  const parsedTx: BtcTransactionData = {
    blockHash: responseTx.block_hash,
    blockHeight: responseTx.block_height,
    blockIndex: responseTx.block_index,
    txid: responseTx.hash,
    hex: responseTx.hex,
    addresses: responseTx.addresses,
    total: responseTx.total,
    fees: responseTx.fees,
    size: responseTx.size,
    preference: responseTx.preference,
    relayedBy: responseTx.relayed_by,
    confirmed: responseTx.confirmed,
    received: responseTx.received,
    ver: responseTx.ver,
    doubleSpend: responseTx.double_spend,
    vinSz: responseTx.vin_sz,
    voutSz: responseTx.vout_sz,
    dataProtocol: responseTx.data_protocol,
    confirmations: responseTx.confirmations,
    confidence: responseTx.confirmations,
    inputs: responseTx.inputs,
    outputs: responseTx.outputs,
    seenTime: new Date(responseTx.received),
    incoming: incoming,
    amount: new BigNumber(amount),
    txType: 'bitcoin',
    txStatus: responseTx.confirmations < 1 ? 'pending' : 'success',
  };

  return parsedTx;
}


