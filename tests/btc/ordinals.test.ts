import { afterEach, assert, describe, expect, it, vi } from 'vitest'
// import { getNonOrdinalUtxo } from '../../api/ordinals'
import { signNonOrdinalBtcSendTransaction } from '../../transactions/btc'
import { 
  BtcUtxoDataResponse, 
} from '../../types';
import * as BTCAPIFunctions from '../../api/btc';
import * as OrdinalsAPIFunctions from '../../api/ordinals';
import * as XverseAPIFunctions from '../../api/xverse';
import axios from 'axios';
import { testSeed } from '../mocks';

it('can create non-ordinal BTC transfer from ordinals address', async () => {
  const utxos: Array<BtcUtxoDataResponse> = [
    {
      "tx_hash": "5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143",
      "block_height": 780443,
      "tx_input_n": -1,
      "tx_output_n": 0,
      "value": 6000,
      "ref_balance": 79908,
      "spent": false,
      "confirmations": 15,
      "confirmed": "2023-03-12T09:13:47Z",
      "double_spend": false,
      "double_spend_tx": ""
    },
    {
      "tx_hash": "76e6733a4c67f99c4447220c26c9bfc4490420603854288bc9eb179b66bd184a",
      "block_height": 779082,
      "tx_input_n": -1,
      "tx_output_n": 0,
      "value": 7780,
      "ref_balance": 73908,
      "spent": false,
      "confirmations": 1376,
      "confirmed": "2023-03-03T06:49:25Z",
      "double_spend": false,
      "double_spend_tx": ""
    },
    {
      "tx_hash": "b048fc332d852d8258a45f5a8b16a346f03a8f5d45b9e94498a5a7db624e01a1",
      "block_height": 778299,
      "tx_input_n": -1,
      "tx_output_n": 0,
      "value": 9445,
      "ref_balance": 57793,
      "spent": false,
      "confirmations": 2159,
      "confirmed": "2023-02-26T03:45:51Z",
      "double_spend": false,
      "double_spend_tx": ""
    }
  ]

  const axiosSpy = vi.spyOn(axios, 'get')
  axiosSpy.mockImplementationOnce(() => Promise.resolve())
  axiosSpy.mockImplementationOnce(() => Promise.resolve({data:{"id":"4800bab89ac67af27cd78c98d9c6944ac5bffb720e6f40de91dc86d234fb93aai0"}}))
  axiosSpy.mockImplementationOnce(() => Promise.resolve())
  
  const fetchOrdinalIdSpy = vi.spyOn(OrdinalsAPIFunctions, 'getOrdinalIdFromUtxo')
  const ordinal = {
    id: '123456'
  }
  const notOrdinal = null
  fetchOrdinalIdSpy.mockImplementationOnce(() => Promise.resolve(notOrdinal))
  fetchOrdinalIdSpy.mockImplementationOnce(() => Promise.resolve(ordinal))
  fetchOrdinalIdSpy.mockImplementationOnce(() => Promise.resolve(notOrdinal))

  const fetchUtxoSpy = vi.spyOn(BTCAPIFunctions, 'fetchBtcAddressUnspent')
  fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos))

  const network = "Mainnet";
  const address = "bc1pr09enf3yc43cz8qh7xwaasuv3xzlgfttdr3wn0q2dy9frkhrpdtsk05jqq";
  const recipientAddress = "37qg72pj86wvAEYh8TK42g7ZyHu5eytdRH";
  const nonOrdinalUtxos = await OrdinalsAPIFunctions.getNonOrdinalUtxo(
    address,
    network
  )

  expect(axiosSpy).toHaveBeenCalledTimes(3)
  expect(nonOrdinalUtxos.length).eq(2)
  expect(nonOrdinalUtxos[0].tx_hash).eq("5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143")
  expect(nonOrdinalUtxos[1].tx_hash).eq("b048fc332d852d8258a45f5a8b16a346f03a8f5d45b9e94498a5a7db624e01a1")

  const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate')
  const feeRate = {
    limits: {
      min: 1,
      max: 5,
    },
    regular: 10,
    priority: 30
  }

  fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate))

  const tx = await signNonOrdinalBtcSendTransaction(
    recipientAddress,
    nonOrdinalUtxos,
    0,
    testSeed,
    network
  )

  expect(tx.tx.outputs[0].amount).eq(13195n)
  expect(tx.fee.toNumber()).eq(2250)
  expect(tx.total.toNumber()).equal(15445)
})
