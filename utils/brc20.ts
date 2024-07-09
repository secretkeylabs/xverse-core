export const isValidContentType = (contentType: string) =>
  contentType.startsWith('text/plain') || contentType.startsWith('application/json');

export const isValidFields = (parsedFields: string[], requiredFields: Set<string>, optionalFields?: Set<string>) =>
  parsedFields.every((f) => requiredFields.has(f) || optionalFields?.has(f)) &&
  [...requiredFields].every((f) => parsedFields.includes(f));

const isNumber = (value: string) => !Number.isNaN(Number(value));

export type Brc20Definition = {
  op: 'deploy' | 'mint' | 'transfer';
  tick: string;
  value: string;
  lim?: string;
  dec?: string;
};

const utf8ByteSize = (str: string) => new Blob([str]).size;

// brc-20 protocol
// - p (protocol): brc-20
// - op (operation): deploy
// - tick (ticker/token identifier): vers
// - max (supply): xxxxx
// - lim (mint limit for each inbscription): xx - optional
// - dec (decimal): 18 - optional
export const getBrc20Details = (content?: string, contentType?: string): undefined | Brc20Definition => {
  if (!content || !contentType) {
    return undefined;
  }

  if (!isValidContentType(contentType)) {
    return undefined;
  }

  try {
    const parsedContent = JSON.parse(content);

    if (parsedContent.p !== 'brc-20' || !['deploy', 'mint', 'transfer'].includes(parsedContent.op)) {
      return undefined;
    }

    const parsedFields = Object.keys(parsedContent);
    const parsedValues = Object.values(parsedContent);

    if (parsedValues.some((v) => typeof v !== 'string')) {
      return undefined;
    }

    const deployRequiredFields = new Set(['p', 'op', 'tick', 'max']);
    const deployOptionalFields = new Set(['lim', 'dec']);

    const mintRequiredFields = new Set(['p', 'op', 'tick', 'amt']);

    const transferRequiredFields = new Set(['p', 'op', 'tick', 'amt']);

    const isValidDeploy =
      parsedContent.op === 'deploy' &&
      isValidFields(parsedFields, deployRequiredFields, deployOptionalFields) &&
      utf8ByteSize(parsedContent.tick) >= 4 &&
      utf8ByteSize(parsedContent.tick) <= 5 &&
      isNumber(parsedContent.max) &&
      (!parsedContent.lim || isNumber(parsedContent.lim)) &&
      (!parsedContent.dec || isNumber(parsedContent.dec));

    const isValidMint =
      parsedContent.op === 'mint' &&
      isValidFields(parsedFields, mintRequiredFields) &&
      utf8ByteSize(parsedContent.tick) >= 4 &&
      utf8ByteSize(parsedContent.tick) <= 5 &&
      isNumber(parsedContent.amt);

    const isValidTransfer =
      parsedContent.op === 'transfer' &&
      isValidFields(parsedFields, transferRequiredFields) &&
      utf8ByteSize(parsedContent.tick) >= 4 &&
      utf8ByteSize(parsedContent.tick) <= 5 &&
      isNumber(parsedContent.amt);

    if (!isValidDeploy && !isValidMint && !isValidTransfer) {
      return undefined;
    }

    return {
      op: parsedContent.op,
      tick: parsedContent.tick.toUpperCase(),
      value: parsedContent.max || parsedContent.amt,
      lim: parsedContent.lim,
      dec: parsedContent.dec,
    };
  } catch (e) {
    return undefined;
  }
};
