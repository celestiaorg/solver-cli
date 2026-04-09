import BigNumber from 'bignumber.js';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const sliceAddress = (
  address: string | undefined,
  visibleLetters = 5
) => {
  if (!address) return '';

  return (
    address.slice(0, visibleLetters) +
    '...' +
    address.slice(address.length - visibleLetters, address.length)
  );
};

export const tryCatch = async <TResponse, TError = Error>(
  promise: Promise<TResponse>
): Promise<[TResponse, null] | [null, TError]> => {
  try {
    const res = await promise;
    return [res, null];
  } catch (error) {
    return [null, error as TError];
  }
};

export const tryCatchSync = <TResponse, TError = Error>(
  res: TResponse
): [TResponse, null] | [null, TError] => {
  try {
    return [res, null];
  } catch (error) {
    return [null, error as TError];
  }
};

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const formatAmount = (
  amount: BigNumber.Value,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
  notation:
    | 'standard'
    | 'scientific'
    | 'engineering'
    | 'compact'
    | undefined = 'standard'
) => {
  const x = new BigNumber(amount);
  const lowest = new BigNumber(10).pow(-maximumFractionDigits);

  if (x.isNaN()) {
    return '';
  }

  if (x.isZero()) {
    return '0';
  }

  if (x.isLessThan(lowest)) {
    return `< ${lowest}`;
  }

  const effectiveMinimumFractionDigits = x.isGreaterThanOrEqualTo(100)
    ? 2
    : minimumFractionDigits;

  return Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: notation,
    maximumFractionDigits: x.isGreaterThanOrEqualTo(100)
      ? effectiveMinimumFractionDigits
      : maximumFractionDigits,
    minimumFractionDigits: effectiveMinimumFractionDigits,
  })
    .format(x.toNumber())
    .slice(1);
};

export const formatAmountWithPrefix = (
  amount: BigNumber.Value,
  prefix: string,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
  notation:
    | 'standard'
    | 'scientific'
    | 'engineering'
    | 'compact'
    | undefined = 'standard'
) => {
  const result = formatAmount(
    amount,
    minimumFractionDigits,
    maximumFractionDigits,
    notation
  );

  if (result.startsWith('<')) {
    return `< ${prefix}${result.slice(2)}`;
  }

  return `${prefix}${result}`;
};
