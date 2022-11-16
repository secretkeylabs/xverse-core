import { AssetInfo, createAssetInfo, FungibleConditionCode, hexToCV, makeStandardFungiblePostCondition, makeStandardNonFungiblePostCondition, NonFungibleConditionCode, PostCondition } from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import {
  StxTransactionDataResponse,
  StxTransactionData,
  StxMempoolTransactionDataResponse,
  StxMempoolTransactionData,
  TransferTransaction,
  PostConditionsOptions,
} from 'types';

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

export function getNewNonce(
  pendingTransactions: StxMempoolTransactionData[],
  currentNonce: bigint
): bigint {
  if ((pendingTransactions ?? []).length === 0) {
    // handle case where account nonce is 0 and no pending transactions
    return currentNonce;
  }
  const maxPendingNonce = Math.max(
    ...(pendingTransactions ?? []).map((transaction) => transaction?.nonce)
  );
  if (maxPendingNonce >= currentNonce) {
    return BigInt(maxPendingNonce + 1);
  } else {
    return currentNonce;
  }
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

export function makeNonFungiblePostCondition(
  options: PostConditionsOptions,
): PostCondition {
  const {contractAddress, contractName, assetName, stxAddress, amount} =
    options;

  const assetInfo: AssetInfo = createAssetInfo(
    contractAddress,
    contractName,
    assetName,
  );
  return makeStandardNonFungiblePostCondition(
    stxAddress,
    NonFungibleConditionCode.DoesNotOwn,
    assetInfo,
    hexToCV(amount.toString()),
  );
}

export function makeFungiblePostCondition(
  options: PostConditionsOptions,
): PostCondition {
  const {contractAddress, contractName, assetName, stxAddress, amount} =
    options;

  const assetInfo = createAssetInfo(contractAddress, contractName, assetName);
  return makeStandardFungiblePostCondition(
    stxAddress,
    FungibleConditionCode.Equal,
    BigInt(amount),
    assetInfo,
  );
}
