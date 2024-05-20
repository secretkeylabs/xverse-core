import { ContractCallPayload, TransactionTypes } from '@stacks/connect';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { BigNumber } from 'bignumber.js';
import { describe, expect, it, vi } from 'vitest';
import { fetchStxPendingTxData } from '../../api/stacks';
import { txPayloadToRequest } from '../../connect';
import { microstacksToStx } from '../../currency';
import {
  createContractCallPromises,
  generateContractDeployTransaction,
  generateUnsignedStxTokenTransferTransaction,
} from '../../transactions';

vi.mock('../../api/stacks');

describe('txPayloadToRequest', () => {
  it('should convert TokenTransfer payload to TransactionPayload', async () => {
    // Mock data
    const mockTokenTransferPayload = {
      amount: '102',
      appDetails: { name: 'Alex app', icon: 'https://alexgo.io/wp-content/themes/alex/img/logo_tm.png' },
      memo: 'From demo app',
      network: new StacksTestnet(),
      publicKey: '034d917f6eb23798ff1dcfba8665f4542a1ea957e7b6587d79797a595c5bfba2f6',
      recipient: 'ST1X6M947Z7E58CNE0H8YJVJTVKS9VW0PHEG3NHN3',
      stxAddress: 'ST143SNE1S5GHKR9JN89BEVFK9W03S1FSNZ4RCVAY',
      txType: TransactionTypes.STXTransfer,
    };

    const unsignedSendStxTx = await generateUnsignedStxTokenTransferTransaction(
      mockTokenTransferPayload.recipient,
      mockTokenTransferPayload.amount,
      mockTokenTransferPayload.memo,
      [],
      mockTokenTransferPayload.publicKey,
      new StacksTestnet(),
    );

    const result = txPayloadToRequest(unsignedSendStxTx);

    expect(result).toBeDefined();
    expect(result).toEqual(
      expect.objectContaining({
        amount: microstacksToStx(new BigNumber(mockTokenTransferPayload.amount)).toString(),
        recipient: mockTokenTransferPayload.recipient,
        memo: mockTokenTransferPayload.memo,
        txType: mockTokenTransferPayload.txType,
      }),
    );
  });

  it('should convert ContractDeploy payload to TransactionPayload', async () => {
    // Mock data
    const mockContractDeploy = {
      codeBody:
        // eslint-disable-next-line max-len
        '\n(define-fungible-token connect-token)\n(begin (ft-mint? connect-token u10000000 tx-sender))\n\n(define-public (transfer\n    (recipient principal)\n    (amount uint)\n  )\n  (ok (ft-transfer? connect-token amount tx-sender recipient))\n)\n\n(define-public (faucet)\n  (ok (ft-mint? connect-token u100 tx-sender))\n)\n\n(define-non-fungible-token hello-nft uint)\n(begin (nft-mint? hello-nft u1 tx-sender))\n(begin (nft-mint? hello-nft u2 tx-sender))\n',
      contractName: 'demo-deploy-1701352463789',
      network: new StacksTestnet(),
      publicKey: '034d917f6eb23798ff1dcfba8665f4542a1ea957e7b6587d79797a595c5bfba2f6',
      stxAddress: 'ST143SNE1S5GHKR9JN89BEVFK9W03S1FSNZ4RCVAY',
      txType: 'smart_contract',
    };

    const unsignedSendStxTx = await generateContractDeployTransaction({
      codeBody: mockContractDeploy.codeBody,
      contractName: mockContractDeploy.contractName,
      publicKey: mockContractDeploy.publicKey,
      pendingTxs: [],
      network: new StacksTestnet(),
    });

    const result = txPayloadToRequest(unsignedSendStxTx);

    expect(result).toBeDefined();
    expect(result).toEqual(
      expect.objectContaining({
        codeBody: mockContractDeploy.codeBody,
        contractName: mockContractDeploy.contractName,
      }),
    );
  });

  it('should convert ContractCall payload to TransactionPayload', async () => {
    // Mock data
    const contractCallPayload: ContractCallPayload = {
      anchorMode: 3,
      appDetails: { name: 'Alex app', icon: 'https://alexgo.io/wp-content/themes/alex/img/logo_tm.png' },
      contractAddress: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
      contractName: 'amm-swap-pool-v1-1',
      functionArgs: [
        '0616e685b016b3b6cd9ebf35f38e5ae29392e2acd51d0a746f6b656e2d77737478',
        '0616e685b016b3b6cd9ebf35f38e5ae29392e2acd51d176167653030302d676f7665726e616e63652d746f6b656e',
        '0100000000000000000000000005f5e100',
        '0100000000000000000000000002faf080',
        '0a010000000000000000000000001a612f25',
      ],
      functionName: 'swap-helper',
      network: new StacksMainnet(),
      postConditionMode: 2,
      postConditions: [
        '000216483cd5c1c96119e132aa12b76df34f003c85f9af01000000000007a120',
        // eslint-disable-next-line max-len
        '010316e685b016b3b6cd9ebf35f38e5ae29392e2acd51d0f616c65782d7661756c742d76312d3116e685b016b3b6cd9ebf35f38e5ae29392e2acd51d176167653030302d676f7665726e616e63652d746f6b656e04616c657803000000001a612f25',
      ],
      publicKey: '03f746046bacb5ff6254124bbdadbe28ca1cfefbd9cd160403667a772f25f298ab',
      stxAddress: 'SP143SNE1S5GHKR9JN89BEVFK9W03S1FSNYC5SQMV',
      txType: TransactionTypes.ContractCall,
    };

    vi.mocked(fetchStxPendingTxData).mockResolvedValue({ pendingTransactions: [] });

    const unSignedContractCall = await createContractCallPromises(
      contractCallPayload,
      'SP143SNE1S5GHKR9JN89BEVFK9W03S1FSNYC5SQMV',
      new StacksMainnet(),
      '03f746046bacb5ff6254124bbdadbe28ca1cfefbd9cd160403667a772f25f298ab',
    );

    const result = txPayloadToRequest(unSignedContractCall[0]);

    expect(result).toBeDefined();

    expect(result.postConditions).toEqual(contractCallPayload.postConditions);
    expect((result as ContractCallPayload).contractAddress).toEqual(contractCallPayload.contractAddress);
    expect((result as ContractCallPayload).functionName).toEqual(contractCallPayload.functionName);
    expect((result as ContractCallPayload).txType).toEqual(contractCallPayload.txType);
    expect((result as ContractCallPayload).contractName).toEqual(contractCallPayload.contractName);
    expect((result as ContractCallPayload).functionArgs).toEqual(contractCallPayload.functionArgs);
    expect((result as ContractCallPayload).postConditionMode).toEqual(contractCallPayload.postConditionMode);
  });
});
