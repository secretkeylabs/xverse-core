export function hexToString(hex: string): string {
  let str = '';
  for (let n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  str = str.replace(/\0/g, '');
  return str.toString().trim();
}
