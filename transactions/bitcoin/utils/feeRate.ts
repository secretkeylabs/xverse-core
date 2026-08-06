export const assertValidFeeRate = (feeRate: number): void => {
  if (!Number.isFinite(feeRate) || feeRate <= 0) {
    throw new Error('Invalid fee rate');
  }
};
