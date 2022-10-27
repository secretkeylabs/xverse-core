import { StacksMainnet, StacksTestnet } from '@stacks/network';
import {
    addressToString, broadcastTransaction, ChainID, createStacksPrivateKey, StacksTransaction, TransactionSigner, TxBroadcastResultOk, TxBroadcastResultRejected,
  } from '@stacks/transactions';
import { NetworkType } from 'types/network';
import { getStxAddressKeyChain } from '../wallet/index';
  
  export async function signTransaction(
    unsignedTx: StacksTransaction,
    seedPhrase: string,
    accountIndex: number,
    network: NetworkType,
  ): Promise<StacksTransaction> {
    const tx = unsignedTx;
    const {privateKey} = await getStxAddressKeyChain(
      seedPhrase,
      network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet,
      accountIndex,
    );
    const signer = new TransactionSigner(tx);
    const stacksPrivateKey = createStacksPrivateKey(privateKey);
    signer.signOrigin(stacksPrivateKey);
  
    return tx;
  }
  
  export async function broadcastSignedTransaction(
    signedTx: StacksTransaction,
    network: NetworkType,
  ): Promise<string> {
    const addressUrl = 'https://stacks-node-api.mainnet.stacks.co';
    const txNetwork =
    network === 'Mainnet'
        ? new StacksMainnet({url: addressUrl})
        : new StacksTestnet({url: addressUrl});
    const result = await broadcastTransaction(signedTx, txNetwork);
    if (result.hasOwnProperty('error')) {
      const errorResult = result as TxBroadcastResultRejected;
      throw new Error(errorResult.reason);
    } else {
      const res = result as TxBroadcastResultOk;
      if (signedTx.txid() !== res.txid) {
        throw new Error('post condition error');
      }
      return res.txid;
    }
  }

  export async function signMultiStxTransactions(
    unsignedTxs: Array<StacksTransaction>,
    accountIndex: number,
    network: NetworkType,
    seedPhrase:string,
  ): Promise<Array<StacksTransaction>> {
    try {
      const signedTxPromises: Array<Promise<StacksTransaction>> = [];
      const signingAccountIndex = accountIndex ?? BigInt(0);
      unsignedTxs.forEach((unsignedTx) => {
        signedTxPromises.push(
          signTransaction(
            unsignedTx,
            seedPhrase,
            signingAccountIndex,
            network,
          ),
        );
      });
  
      return Promise.all(signedTxPromises);
    } catch (error: any) {
      return Promise.reject(error.toString());
    }
  }

  export function setNonce(transaction: StacksTransaction, nonce: bigint) {
    transaction.setNonce(nonce);
  }
  
  export function getNonce(transaction: StacksTransaction): bigint {
    return transaction.auth.spendingCondition?.nonce ?? BigInt(0);
  }

  export function setFee(transaction: StacksTransaction, fee: bigint) {
    transaction.setFee(fee);
  }

export { addressToString };