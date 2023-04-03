import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { 
  signMessageBip340,
} from '../../transactions/messageSigning';
import { testSeed } from '../mocks';
import * as btc from 'micro-btc-signer';
import { hex, base64 } from '@scure/base';
import * as secp256k1 from '@noble/secp256k1'
import { getBtcNetwork } from '../../transactions/btcNetwork';

describe('Bitcoin PSBT tests', () => {
  it('can sign message BIP340 for taproot address', async () => {
    const btcAddress = 'bc1qf8njhm2nj48x9kltxvmc7vyl9cq7raukwg6mjk';
    const taprootAddress = 'bc1pr09enf3yc43cz8qh7xwaasuv3xzlgfttdr3wn0q2dy9frkhrpdtsk05jqq';
    const publicKey = '025b21869d6643175e0530aeec51d265290d036384990ee60bf089b23ff6b9a367';

    const accounts = [
      {
        id: 0,
        stxAddress: 'STXADDRESS1',
        btcAddress: btcAddress,
        ordinalsAddress: taprootAddress,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
        ordinalsPublicKey: '123'
      }
    ]

    const messageHash = "243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89";

    const signature = await signMessageBip340(
      testSeed,
      accounts,
      taprootAddress,
      messageHash,
    )

    const verify = await secp256k1.schnorr.verify(
      signature, 
      hex.decode(messageHash), 
      hex.decode(publicKey)
    );
    
    expect(verify).toBe(true);
  })
});