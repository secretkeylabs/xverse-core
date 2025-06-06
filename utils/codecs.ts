import { base64, hex } from '@scure/base';

export const base64ToHex = (base64Str: string) => hex.encode(base64.decode(base64Str));

export const hexToBase64 = (hexStr: string) => base64.encode(hex.decode(hexStr));
