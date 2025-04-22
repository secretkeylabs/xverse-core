import Transport from '@ledgerhq/hw-transport';
import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { AddressType } from 'bitcoin-address-validation';
import AppClient, { DefaultWalletPolicy } from 'ledger-bitcoin';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../../../constant';
import { Bip32Derivation, TapBip32Derivation } from '../../../ledger';
import { createLedgerBip322Signature } from '../../../ledger/btcMessageSigning';
import { getBtcNetworkDefinition } from '../../../transactions/btcNetwork';
import { NetworkType } from '../../../types';
import { BaseAddressRegistrar } from './base';

export class LedgerAddressRegistrar extends BaseAddressRegistrar {
  private transport: Transport;

  private account: number;

  private index: number;

  constructor(challenge: string, network: NetworkType, transport: Transport, account: number, index: number) {
    super(challenge, network);
    this.transport = transport;
    this.account = account;
    this.index = index;
  }

  hydrate = async (type: AddressType.p2wpkh | AddressType.p2tr): Promise<void> => {
    const registrationKey = `${type}:${this.account}:${this.index}`;

    if (this.registrationData[registrationKey]) {
      return;
    }

    if (this.IsFinalized) throw new Error('Address registrar is already finalized');

    const path = type === AddressType.p2wpkh ? BTC_SEGWIT_PATH_PURPOSE : BTC_TAPROOT_PATH_PURPOSE;
    const chain = this.network === 'Mainnet' ? 0 : 1;
    const derivationPath = `${path}${chain}'/${this.account}'/0/${this.index}`;
    const descriptor = type === AddressType.p2wpkh ? 'wpkh' : 'tr';
    const signDerivationPath = `${derivationPath}/42`;
    const pathSuffix = 'm/42';

    const app = new AppClient(this.transport);

    const extendedPublicKey = await app.getExtendedPubkey(derivationPath);

    const masterFingerPrint = await app.getMasterFingerprint();
    const signExtendedPublicKey = await app.getExtendedPubkey(signDerivationPath);
    const accountPolicy = new DefaultWalletPolicy(
      `${descriptor}(@0/**)`,
      `[${masterFingerPrint}/${signDerivationPath}]${signExtendedPublicKey}`,
    );
    const signXPub = hex.decode(signExtendedPublicKey);

    const btcNetwork = getBtcNetworkDefinition(this.network);

    let lockScript: Uint8Array;
    let derivation:
      | {
          bip32Derivation: Bip32Derivation[];
        }
      | {
          tapBip32Derivation: TapBip32Derivation[];
          tapInternalKey: Buffer;
        };
    let isSegwit: boolean;
    if (type === AddressType.p2tr) {
      let tapInternalKey = signXPub;
      if (tapInternalKey.length === 33) {
        tapInternalKey = tapInternalKey.slice(1);
      }

      const p2tr = btc.p2tr(tapInternalKey, undefined, btcNetwork);
      lockScript = p2tr.script;
      derivation = {
        tapBip32Derivation: [
          {
            path: signDerivationPath,
            pubkey: Buffer.from(signXPub),
            masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
            leafHashes: [],
          },
        ],
        tapInternalKey: Buffer.from(tapInternalKey),
      };
      isSegwit = false;
    } else {
      const p2wpkh = btc.p2wpkh(signXPub, btcNetwork);
      lockScript = p2wpkh.script;
      derivation = {
        bip32Derivation: [
          {
            path: signDerivationPath,
            pubkey: Buffer.from(signXPub),
            masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
          },
        ],
      };
      isSegwit = true;
    }

    const { signature } = await createLedgerBip322Signature(
      app,
      accountPolicy,
      this.challenge + pathSuffix,
      Buffer.from(lockScript),
      derivation,
      isSegwit,
    );

    this.registrationData[registrationKey] = {
      pathSuffix,
      xPubKey: extendedPublicKey,
      signature,
      type,
    };

    if (Object.keys(this.registrationData).length === 2) {
      // we've got both the payment and ordinals address signatures
      this.IsFinalized = true;
    }
  };
}
