import { getZoneFileStub, generateSalt, generatePreorderNameHash, generateUnsignedBnsNameRegisterTransaction, generateUnsignedBnsNamePreorderTransaction, generateUnsignedBnsNameUpdateTransaction, generateUnsignedBnsNameTransferTransaction } from '../../transactions/bns'
import { getZoneFileForBnsName } from '../../api/bns';
import { signTransaction, broadcastSignedTransaction } from '../../transactions/stx'
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { newWallet, walletFromSeedPhrase } from '../../wallet'
import { parseZoneFile, makeZoneFile, addAddress, ZoneFileObject, setAddresses } from '@secretkeylabs/bns-zonefile';
import { assert, describe, expect, it } from 'vitest';
import { testSeedBns } from '../mocks';

describe('bns api', () => {
  it.skip('bns name preorder', async () => {
    let network = new StacksTestnet();
    let testIndex = 0;
    let wallet = await walletFromSeedPhrase({mnemonic: testSeedBns, network: 'Testnet', index: BigInt(testIndex)});
    let namespace = 'id';
    let name = 'testname0';
    //let salt = generateSalt();
    let salt = Buffer.from([ 14, 154, 95, 185, 168, 74, 239, 236, 26, 226, 22, 95, 82, 44, 87, 227, 203, 153, 26, 11 ])
    //console.log('salt:', new Uint32Array(salt));
    console.log('hash:', generatePreorderNameHash(namespace, name, salt));

    let unsignedTx = await generateUnsignedBnsNamePreorderTransaction(namespace, name, salt, [], wallet.stxPublicKey, network);
    let signedTx = await signTransaction(unsignedTx, testSeedBns, testIndex, network);

    let txid = await broadcastSignedTransaction(signedTx, network);
    console.log('txid:', txid);
  });

  it.skip('bns name register', async () => {
    let network = new StacksTestnet();
    let testIndex = 0;
    let wallet = await walletFromSeedPhrase({mnemonic: testSeedBns, network: 'Testnet', index: BigInt(testIndex)});
    let testAddress = wallet.stxAddress;
    console.log(testAddress);
    let namespace = 'id';
    let name = 'testname0';
    let coin = 'stx';
    let zoneFileObj = getZoneFileStub(namespace, name);
    addAddress(zoneFileObj, coin, testAddress, true);
    let zoneFileStr = makeZoneFile(zoneFileObj);
    let salt = Buffer.from([ 14, 154, 95, 185, 168, 74, 239, 236, 26, 226, 22, 95, 82, 44, 87, 227, 203, 153, 26, 11 ])
    console.log('salt:', new Uint32Array(salt));

    let unsignedTx = await generateUnsignedBnsNameRegisterTransaction(namespace, name, salt, zoneFileObj, [], wallet.stxPublicKey, network);
    let signedTx = await signTransaction(unsignedTx, testSeedBns, testIndex, network);

    let txid = await broadcastSignedTransaction(signedTx, network, Buffer.from(zoneFileStr));
    console.log('txid:', txid);
  });

  it.skip('bns name update', async () => {
    let network = new StacksTestnet();
    let testIndex = 0;
    let wallet = await walletFromSeedPhrase({mnemonic: testSeedBns, network: 'Testnet', index: BigInt(testIndex)});
    let testAddress = wallet.stxAddress;
    let namespace = 'id';
    let name = 'testname0';
    let coin = 'stx';
    let zoneFileObj = await getZoneFileForBnsName(name + '.' + namespace, network) as ZoneFileObject;
    console.log(zoneFileObj);
    setAddresses(zoneFileObj, coin, [testAddress]);
    console.log(zoneFileObj);

    let zoneFileStr = makeZoneFile(zoneFileObj);

    let unsignedTx = await generateUnsignedBnsNameUpdateTransaction(namespace, name, zoneFileObj, [], wallet.stxPublicKey, network);
    let signedTx = await signTransaction(unsignedTx, testSeedBns, testIndex, network);

    let txid = await broadcastSignedTransaction(signedTx, network, Buffer.from(zoneFileStr));
    console.log('txid:', txid);
  });

  it('bns name transfer', async () => {
    let network = new StacksTestnet();
    let testIndex = 0;
    let wallet = await walletFromSeedPhrase({mnemonic: testSeedBns, network: 'Testnet', index: BigInt(testIndex)});
    let newOwnerAddress = 'ST1D4Q88SDXQ7PFRAWA0ABKT9NTPTVA7NWG9R4VDH';
    let namespace = 'id';
    let name = 'testname0';

    let unsignedTx = await generateUnsignedBnsNameTransferTransaction(namespace, name, newOwnerAddress, [], wallet.stxPublicKey, network);
    let signedTx = await signTransaction(unsignedTx, testSeedBns, testIndex, network);

    let txid = await broadcastSignedTransaction(signedTx, network);
    console.log('txid:', txid);
  });

})