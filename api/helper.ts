import BigNumber from 'bignumber.js';
import {
  Input,
  Output,
  BtcTransactionData,
  BtcTransactionDataResponse,
  StxTransactionData,
  StxMempoolTransactionData,
  StxTransactionDataResponse,
  StxMempoolTransactionDataResponse,
  TransferTransaction,
} from '../types';

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

export function parseOrdinalsBtcTransactions(
  responseTx: BtcTransactionDataResponse,
  ordinalsAddress: string
): BtcTransactionData {
  let inputAddresses: string[] = [];
  responseTx.inputs.forEach((input) => {
    if (input.addresses !== null && input.addresses.length > 0) {
      inputAddresses = [...inputAddresses, ...input.addresses];
    }
  });
  const inputAddressSet = new Set(inputAddresses);
  const incoming = !inputAddressSet.has(ordinalsAddress);
    const parsedTx: BtcTransactionData = {
      blockHash: responseTx.block_hash,
      blockHeight: responseTx.block_height,
      blockIndex: responseTx.block_index,
      txid: responseTx.hash,
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
      incoming,
      amount: new BigNumber(0),
      txType: 'bitcoin',
      txStatus: responseTx.confirmations < 1 ? 'pending' : 'success',
      isOrdinal: true,
    };
    return parsedTx;
} 

export function parseBtcTransactionData(
  responseTx: BtcTransactionDataResponse,
  btcAddress: string,
  ordinalsAddress: string,
): BtcTransactionData {
  let inputAddresses: string[] = [];
  responseTx.inputs.forEach((input) => {
    if (input.addresses !== null && input.addresses.length > 0) {
        inputAddresses = [...inputAddresses, ...input.addresses];
    }
  });
  const inputAddressSet = new Set(inputAddresses);

  const incoming = !inputAddressSet.has(btcAddress);
  const isOrdinal = inputAddressSet.has(ordinalsAddress);

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
    isOrdinal,
  };

  return parsedTx;
}

export function deDuplicatePendingTx({
  confirmedTransactions,
  pendingTransactions,
}: {
  confirmedTransactions: StxTransactionData[];
  pendingTransactions: StxMempoolTransactionData[];
}): StxMempoolTransactionData[] {
  return pendingTransactions.filter((pt) =>
    confirmedTransactions.some((ct) => pt.txid !== ct.txid)
  );
}

export function mapTransferTransactionData({
  responseTx,
  stxAddress,
}: {
  responseTx: TransferTransaction;
  stxAddress: string;
}): StxTransactionData {
  const {
    block_hash,
    block_height,
    burn_block_time,
    burn_block_time_iso,
    canonical,
    fee_rate,
    nonce,
    post_condition_mode,
    sender_address,
    sponsored,
    tx_id,
    tx_index,
    tx_result,
    tx_status,
    tx_type,
    post_conditions,
    contract_call,
  } = responseTx;

  return {
    blockHash: block_hash,
    blockHeight: block_height,
    burnBlockTime: burn_block_time,
    burnBlockTimeIso: new Date(burn_block_time_iso),
    canonical: canonical,
    fee: new BigNumber(fee_rate),
    nonce,
    postConditionMode: post_condition_mode,
    senderAddress: sender_address,
    sponsored,
    txid: tx_id,
    txIndex: tx_index,
    txResults: JSON.stringify(tx_result),
    txStatus: tx_status,
    txType: tx_type,
    seenTime: new Date(burn_block_time_iso),
    incoming: sender_address !== stxAddress,
    amount: new BigNumber(
      post_conditions.find((x) => x !== undefined)?.type === 'fungible'
        ? post_conditions.find((x) => x !== undefined)?.amount ?? 0
        : 0
    ),
    post_conditions: [],
    assetId: post_conditions.find((x) => x !== undefined)?.asset_value?.repr.substring(1),
    tokenType: post_conditions.find((x) => x !== undefined)?.type,
    contractCall: tx_type === 'contract_call' ? contract_call : undefined,
  };
}

export function parseMempoolStxTransactionsData({
  responseTx,
  stxAddress,
}: {
  responseTx: StxMempoolTransactionDataResponse;
  stxAddress: string;
}): StxMempoolTransactionData {
  const parsedTx: StxMempoolTransactionData = {
    receiptTime: responseTx.receipt_time,
    receiptTimeIso: new Date(responseTx.receipt_time_iso),
    fee: new BigNumber(responseTx.fee_rate),
    nonce: responseTx.nonce,
    postConditionMode: responseTx.post_condition_mode,
    senderAddress: responseTx.sender_address,
    sponsored: responseTx.sponsored,
    txid: responseTx.tx_id,
    txStatus: responseTx.tx_status,
    txType: responseTx.tx_type,
    seenTime: new Date(responseTx.receipt_time_iso),
    incoming: responseTx.sender_address !== stxAddress,
    amount: new BigNumber(0),
    post_conditions: [],
  };

  // add token transfer data if type is token transfer
  if (parsedTx.txType === 'token_transfer') {
    parsedTx.tokenTransfer = {
      recipientAddress: responseTx.token_transfer.recipient_address,
      amount: new BigNumber(responseTx.token_transfer.amount),
      memo: responseTx.token_transfer.memo,
    };
    const amount = new BigNumber(responseTx.token_transfer.amount);
    parsedTx.amount = amount;
  }

  if (responseTx.post_conditions && responseTx.post_conditions.length > 0) {
    parsedTx.tokenType = responseTx.post_conditions.find((x) => x !== undefined)?.type;
    if (responseTx.post_conditions.find((x) => x !== undefined)?.asset_value)
      parsedTx.assetId = responseTx.post_conditions
        .find((x) => x !== undefined)
        ?.asset_value?.repr.substring(1);
    if (parsedTx.tokenType === 'fungible') {
      if (responseTx.contract_call?.function_name === 'transfer') {
        parsedTx.amount = new BigNumber(
          responseTx.post_conditions.find((x) => x !== undefined)?.amount ?? 0
        );
      }
    }
  }
  if (parsedTx.txType === 'contract_call') {
    parsedTx.contractCall = responseTx.contract_call;
  }
  return parsedTx;
}

export function parseStxTransactionData({
  responseTx,
  stxAddress,
}: {
  responseTx: StxTransactionDataResponse;
  stxAddress: string;
}): StxTransactionData {
  const parsedTx: StxTransactionData = {
    blockHash: responseTx.block_hash,
    blockHeight: responseTx.block_height,
    burnBlockTime: responseTx.burn_block_time,
    burnBlockTimeIso: new Date(responseTx.burn_block_time_iso),
    canonical: responseTx.canonical,
    fee: new BigNumber(responseTx.fee_rate),
    nonce: responseTx.nonce,
    postConditionMode: responseTx.post_condition_mode,
    senderAddress: responseTx.sender_address,
    sponsored: responseTx.sponsored,
    txid: responseTx.tx_id,
    txIndex: responseTx.tx_index,
    txResults: responseTx.tx_results,
    txStatus: responseTx.tx_status,
    txType: responseTx.tx_type,
    seenTime: new Date(responseTx.burn_block_time_iso),
    incoming: responseTx.sender_address !== stxAddress,
    amount: new BigNumber(0),
    post_conditions: [],
  };

  // add token transfer data if type is token transfer
  if (parsedTx.txType === 'token_transfer') {
    parsedTx.tokenTransfer = {
      recipientAddress: responseTx.token_transfer.recipient_address,
      amount: new BigNumber(responseTx.token_transfer.amount),
      memo: responseTx.token_transfer.memo,
    };
    const amount = new BigNumber(responseTx.token_transfer.amount);
    parsedTx.amount = amount;
  }
  if (parsedTx.txType === 'contract_call') {
    parsedTx.contractCall = responseTx.contract_call;
    if (responseTx.contract_call?.function_name === 'transfer') {
      if (responseTx.post_conditions && responseTx.post_conditions.length > 0) {
        parsedTx.tokenType = responseTx.post_conditions.find((x) => x !== undefined)?.type;
        parsedTx.amount = new BigNumber(
          responseTx.post_conditions.find((x) => x !== undefined)?.amount ?? 0
        );
        parsedTx.tokenName = responseTx.post_conditions.find(
          (x) => x !== undefined
        )?.asset.asset_name;
        if (responseTx.post_conditions.find((x) => x !== undefined)?.asset_value)
          parsedTx.assetId = responseTx.post_conditions
            .find((x) => x !== undefined)
            ?.asset_value?.repr.substring(1);
      }
    }
  }

  return parsedTx;
}




