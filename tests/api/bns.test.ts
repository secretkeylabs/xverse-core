import { getBnsNamesForOwner, getZoneFileForBnsName, getBnsNameData, getOwnerForBnsName, getCanBnsNameBeRegistered, getCanReceiveBnsName, getBnsNamePrice } from '../../api/bns'
import { fetchAddressOfBnsName, getBnsName } from '../../api/stacks';
import { StacksMainnet } from '@stacks/network';
import { assert, describe, expect, it } from 'vitest';

describe('bns api', () => {
  it('get bns names', async () => {
    let network = new StacksMainnet();
    let address = 'SP2XEVF5ZJ75VMKSQD05HEV85BX3J534D9VECQ95K';
    let res = await getBnsNamesForOwner(address, network);
    expect(res).toEqual(['muneeb.id']);

    let res2 = await getBnsName(address, network);
    expect(res2).toEqual('muneeb.id');
  });

  it('get zone file for bns name', async () => {
    let network = new StacksMainnet();
    let bnsName = 'muneeb.id';
    let res = await getZoneFileForBnsName(bnsName, network);
    expect(res?.$origin).toEqual('muneeb.id');
    expect(res?.$ttl).toEqual(3600);
  });

  it('get bns name data', async () => {
    let network = new StacksMainnet();
    let address = 'SP2XEVF5ZJ75VMKSQD05HEV85BX3J534D9VECQ95K';
    let bnsName = 'muneeb.id'
    let res = await getBnsNameData(bnsName, network);
    expect(res.address).toEqual(address);
    expect(res.blockchain).toEqual('stacks');
  });

  it('get owner for bns name', async () => {
    let network = new StacksMainnet();
    let testAddress = 'SP14K3Z06S8EGN66PXFQFQ2B1FZWAR93FVM4XT62G';
    let address = 'SP2XEVF5ZJ75VMKSQD05HEV85BX3J534D9VECQ95K';
    let bnsName = 'muneeb.id';
    let res = await getOwnerForBnsName(bnsName, testAddress, network);
    expect(res).toEqual(address);

    res = await fetchAddressOfBnsName(bnsName, testAddress, network);
    expect(res).toEqual(address);

    let bnsName2 = 'yukan.id';
    let res2 = await getOwnerForBnsName(bnsName2, testAddress, network);
    expect(res2).toEqual('');
  });

  it('can bns name be registered', async () => {
    let network = new StacksMainnet();
    let testAddress = 'SP14K3Z06S8EGN66PXFQFQ2B1FZWAR93FVM4XT62G';
    let bnsName = 'muneeb.btc';
    let res = await getCanBnsNameBeRegistered(bnsName, testAddress, network);
    expect(res).toEqual(false);

    let bnsName2 = 'yukan.id';
    let res2 = await getCanBnsNameBeRegistered(bnsName2, testAddress, network);
    expect(res2).toEqual(true);
  });

  it('can receive name', async () => {
    let network = new StacksMainnet();
    let testAddress = 'SP14K3Z06S8EGN66PXFQFQ2B1FZWAR93FVM4XT62G';
    let res = await getCanReceiveBnsName(testAddress, network);
    expect(res).toEqual(true);

    let muneebAddress = 'SP2XEVF5ZJ75VMKSQD05HEV85BX3J534D9VECQ95K';
    let res2 = await getCanReceiveBnsName(muneebAddress, network);
    expect(res2).toEqual(false);
  });

  it('get name price', async () => {
    let network = new StacksMainnet();
    let testAddress = 'SP14K3Z06S8EGN66PXFQFQ2B1FZWAR93FVM4XT62G';
    let namespace = 'id';
    let name = 'test';
    let res = await getBnsNamePrice(namespace, name, testAddress, network);
    expect(res).toEqual(6933120n);
  });

})
