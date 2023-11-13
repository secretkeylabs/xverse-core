import { UTXO } from '../../types';

import { Action, ActionMap, ActionType } from './types';

export const areByteArraysEqual = (a?: Uint8Array, b?: Uint8Array): boolean => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return a.every((v, i) => v === b[i]);
};

export const getOutpoint = (transactionId: string, vout: string | number) => {
  return `${transactionId}:${vout}`;
};

export const getOutpointFromLocation = (location: string) => {
  const [txid, vout] = location.split(':');
  return getOutpoint(txid, vout);
};

export const getOffsetFromLocation = (location: string) => {
  const [, , offset] = location.split(':');
  return +offset;
};

export const getOutpointFromUtxo = (utxo: UTXO) => {
  return getOutpoint(utxo.txid, utxo.vout);
};

export const extractActionMap = (actions: Action[]): ActionMap => {
  const actionMap = {
    [ActionType.SEND_UTXO]: [],
    [ActionType.SPLIT_UTXO]: [],
    [ActionType.SEND_BTC]: [],
  } as ActionMap;
  for (const action of actions) {
    const actionType = action.type;
    actionMap[actionType].push(action);
  }

  const reservedUtxos = new Set<string>();

  for (const action of actionMap[ActionType.SPLIT_UTXO]) {
    reservedUtxos.add(getOutpointFromLocation(action.location));
  }

  for (const action of actionMap[ActionType.SEND_UTXO]) {
    const outpoint = action.outpoint;
    if (reservedUtxos.has(outpoint)) {
      throw new Error(`duplicate UTXO being spent: ${outpoint}`);
    }
    reservedUtxos.add(outpoint);
  }

  return actionMap;
};
