export function hexToString(hex: string): string {
    var str: string = '';
    for (var n = 0; n < hex.length; n += 2) {
      str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    str = str.replace(/\0/g, '');
    return str.toString().trim();
  }