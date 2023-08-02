import { StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';
import {
  BtcTransactionData,
  StxMempoolTransactionData,
  StxMempoolTransactionDataResponse,
  StxTransactionData,
  StxTransactionDataResponse,
  TransferTransaction,
  Brc20HistoryTransactionData,
  OrdinalTokenTransaction,
} from '../types';

import { HIRO_MAINNET_DEFAULT, HIRO_TESTNET_DEFAULT, ORDINALS_URL } from '../constant';
import * as esplora from '../types/api/esplora';

export function sumOutputsForAddress(outputs: esplora.Vout[], address: string): number {
  let total = 0;
  outputs.forEach((output) => {
    if (output.scriptpubkey_address) {
      if (output.scriptpubkey_address === address) {
        total += output.value;
      }
    }
  });
  return total;
}

export function sumInputsForAddress(inputs: esplora.Vin[], address: string): number {
  let total = 0;
  inputs.forEach((input) => {
    if (input.prevout.scriptpubkey_address === address) {
      total += input.prevout.value;
    }
  });
  return total;
}

export function parseOrdinalsBtcTransactions(
  responseTx: esplora.Transaction,
  ordinalsAddress: string,
): BtcTransactionData {
  const inputAddresses: string[] = [];
  responseTx.vin.forEach((input) => {
    if (input.prevout.scriptpubkey_address) {
      inputAddresses.push(input.prevout.scriptpubkey_address);
    }
  });
  const inputAddressSet = new Set(inputAddresses);
  const incoming = !inputAddressSet.has(ordinalsAddress);

  const outputAddresses: string[] = [];
  responseTx.vout.forEach((output) => {
    if (output.scriptpubkey_address && output.scriptpubkey_address !== ordinalsAddress) {
      outputAddresses.push(output.scriptpubkey_address);
    }
  });
  let amount = 0;
  if (incoming) {
    amount = sumOutputsForAddress(responseTx.vout, ordinalsAddress);
  } else {
    const inputAmount = sumInputsForAddress(responseTx.vin, ordinalsAddress);
    const changeAmount = sumOutputsForAddress(responseTx.vout, ordinalsAddress);
    amount = inputAmount - changeAmount;
  }

  const total = responseTx.fee + amount;

  const date = new Date(0);
  if (responseTx.status.block_time) date.setUTCSeconds(responseTx.status.block_time);

  const parsedTx: BtcTransactionData = {
    blockHash: responseTx.status.block_hash ?? '',
    blockHeight: responseTx.status.block_height ?? 0,
    txid: responseTx.txid,
    total,
    fees: responseTx.fee,
    size: responseTx.size,
    confirmed: responseTx.status.confirmed,
    inputs: responseTx.vin,
    outputs: responseTx.vout,
    seenTime: date,
    incoming: incoming,
    amount: new BigNumber(amount),
    txType: 'bitcoin',
    txStatus: responseTx.status.confirmed ? 'success' : 'pending',
    isOrdinal: true,
    recipientAddress: outputAddresses[0],
  };
  return parsedTx;
}

export function parseBtcTransactionData(
  responseTx: esplora.Transaction,
  btcAddress: string,
  ordinalsAddress: string,
): BtcTransactionData {
  const inputAddresses: string[] = [];
  responseTx.vin.forEach((input) => {
    if (input.prevout.scriptpubkey_address) {
      inputAddresses.push(input.prevout.scriptpubkey_address);
    }
  });
  const inputAddressSet = new Set(inputAddresses);

  const incoming = !inputAddressSet.has(btcAddress);
  const isOrdinal = inputAddressSet.has(ordinalsAddress);

  const outputAddresses: string[] = [];
  responseTx.vout.forEach((output) => {
    if (
      output.scriptpubkey_address &&
      output.scriptpubkey_address !== btcAddress &&
      output.scriptpubkey_address !== ordinalsAddress
    ) {
      outputAddresses.push(output.scriptpubkey_address);
    }
  });

  // calculate sent/received amount from inputs/outputs
  let amount = 0;
  if (incoming) {
    amount = sumOutputsForAddress(responseTx.vout, btcAddress);
  } else {
    const inputAmount = sumInputsForAddress(responseTx.vin, btcAddress);
    const changeAmount = sumOutputsForAddress(responseTx.vout, btcAddress);
    amount = inputAmount - changeAmount;
  }

  const total = responseTx.fee + amount;
  const date = new Date(0);
  if (responseTx.status.block_time) date.setUTCSeconds(responseTx.status.block_time);

  const parsedTx: BtcTransactionData = {
    blockHash: responseTx.status.block_hash ?? '',
    blockHeight: responseTx.status.block_height ?? 0,
    txid: responseTx.txid,
    total,
    fees: responseTx.fee,
    size: responseTx.size,
    confirmed: responseTx.status.confirmed,
    inputs: responseTx.vin,
    outputs: responseTx.vout,
    seenTime: date,
    incoming: incoming,
    amount: new BigNumber(amount),
    txType: 'bitcoin',
    txStatus: responseTx.status.confirmed ? 'success' : 'pending',
    isOrdinal,
    recipientAddress: outputAddresses[0],
  };

  return parsedTx;
}

export function parseBrc20TransactionData(responseTx: OrdinalTokenTransaction): Brc20HistoryTransactionData {
  const incoming = responseTx.type === 'receive';

  const date = new Date(0);
  if (responseTx.blocktime) date.setUTCSeconds(responseTx.blocktime);

  const parsedTx: Brc20HistoryTransactionData = {
    ...responseTx,
    amount: new BigNumber(responseTx.amount),
    seenTime: date,
    incoming,
    txType: 'brc20',
    txStatus: responseTx?.blocktime === 0 ? 'pending' : 'success',
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
  const txArray: StxMempoolTransactionData[] = [];
  for (const tx of [...confirmedTransactions, ...pendingTransactions]) {
    if (!txArray.find((t) => t.txid === tx.txid)) {
      txArray.push(tx as StxMempoolTransactionData);
    }
  }
  return txArray;
}

export function mapTransferTransactionData({
  responseTx,
  stxAddress,
}: {
  responseTx: TransferTransaction;
  stxAddress: string;
}): StxTransactionData {
  const {
    block_hash: blockHash,
    block_height: blockHeight,
    burn_block_time: burnBlockTime,
    burn_block_time_iso: burnBlockTimeIsoStr,
    canonical,
    fee_rate: feeRate,
    nonce,
    post_condition_mode: postConditionMode,
    sender_address: senderAddress,
    sponsored,
    tx_id: txid,
    tx_index: txIndex,
    tx_result: txResult,
    tx_status: txStatus,
    tx_type: txType,
    post_conditions: postConditions,
    contract_call: contractCall,
  } = responseTx;

  return {
    blockHash,
    blockHeight,
    burnBlockTime,
    burnBlockTimeIso: new Date(burnBlockTimeIsoStr),
    canonical,
    fee: new BigNumber(feeRate),
    nonce,
    postConditionMode,
    senderAddress,
    sponsored,
    txid,
    txIndex,
    txResults: JSON.stringify(txResult),
    txStatus,
    txType,
    seenTime: new Date(burnBlockTimeIsoStr),
    incoming: senderAddress !== stxAddress,
    amount: new BigNumber(
      postConditions.find((x) => x !== undefined)?.type === 'fungible'
        ? postConditions.find((x) => x !== undefined)?.amount ?? 0
        : 0,
    ),
    post_conditions: [],
    assetId: postConditions.find((x) => x !== undefined)?.asset_value?.repr.substring(1),
    tokenType: postConditions.find((x) => x !== undefined)?.type,
    contractCall: txType === 'contract_call' ? contractCall : undefined,
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
      parsedTx.assetId = responseTx.post_conditions.find((x) => x !== undefined)?.asset_value?.repr.substring(1);
    if (parsedTx.tokenType === 'fungible') {
      if (responseTx.contract_call?.function_name === 'transfer') {
        parsedTx.amount = new BigNumber(responseTx.post_conditions.find((x) => x !== undefined)?.amount ?? 0);
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
        parsedTx.amount = new BigNumber(responseTx.post_conditions.find((x) => x !== undefined)?.amount ?? 0);
        parsedTx.tokenName = responseTx.post_conditions.find((x) => x !== undefined)?.asset.asset_name;
        if (responseTx.post_conditions.find((x) => x !== undefined)?.asset_value)
          parsedTx.assetId = responseTx.post_conditions.find((x) => x !== undefined)?.asset_value?.repr.substring(1);
      }
    }
  }

  return parsedTx;
}

/**
 * Solves issue wiht proper network address
 *
 * @param {StacksNetwork} network object to be used for distinguish is user on mainnet or testnet
 *
 * @returns {string} Network URL to be used
 */
export const getNetworkURL = (network: StacksNetwork): string => {
  return network.isMainnet() ? HIRO_MAINNET_DEFAULT : HIRO_TESTNET_DEFAULT;
};

export function getFetchableUrl(uri: string, protocol: string): string | null {
  const publicIpfs = 'https://cf-ipfs.com/ipfs';
  if (protocol === 'http') return uri;
  if (protocol === 'ipfs') {
    const url = uri.split('//');
    return `${publicIpfs}/${url[1]}`;
  }
  return null;
}

export function getOrdinalImageUrl(content: string): string | null {
  return getFetchableUrl(`${ORDINALS_URL}${content}`, 'http');
}
