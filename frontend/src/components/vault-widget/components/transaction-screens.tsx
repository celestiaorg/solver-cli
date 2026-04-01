'use client';

import { ArrowLeft } from '@phosphor-icons/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { GenericFallbackIcon } from '@/icons';
import { formatAmount } from '@/lib/utils';

export const TxnProcessing: React.FC<{
  message?: string;
  subMessage?: string;
}> = ({ message, subMessage }) => {
  return (
    <div className="mt-auto w-full">
      <div className="text-foreground flex flex-col items-center gap-3 text-center">
        <div className="border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />

        <div className="text-sm">
          {message || 'Sign your transaction in Leap to continue'}
        </div>
        <div className="text-muted-foreground text-xs">
          {subMessage ||
            'If your wallet does not show a transaction request or never confirms, please try the transfer again.'}
        </div>
      </div>
    </div>
  );
};

export const SuccessScreen: React.FC<{
  asset?: { logoURI?: string; symbol?: string };
  explorerLink?: string;
  amount: string;
  actionType: 'deposit' | 'withdraw';
  onBack: () => void;
  onAgain: () => void;
}> = props => {
  return (
    <>
      <button
        type="button"
        onClick={props.onBack}
        aria-label="Back"
        className="text-foreground/80 hover:bg-foreground/10 w-fit rounded-full p-1"
      >
        <ArrowLeft className="text-foreground size-4" />
      </button>
      <div className="my-auto flex flex-col items-center gap-3 rounded-xl px-5 py-6">
        <div className="text-sm font-semibold">Txn Successful!</div>
        <Avatar className="size-24">
          <AvatarImage src={`${props.asset?.logoURI}`} />
          <AvatarFallback>
            <GenericFallbackIcon className="size-24" />
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-3.5xl font-bold">
            {' '}
            {formatAmount(props.amount)} {props.asset?.symbol}
            {props.actionType === 'withdraw' ? ' Withdrawn' : ' Deposited'}
          </p>
        </div>
        {props.explorerLink && (
          <a
            className="text-sm underline"
            href={props.explorerLink}
            target="_blank"
            rel="noreferrer"
          >
            View txn
          </a>
        )}
      </div>
      <Button
        className="text-md mt-auto w-full font-medium"
        size="lg"
        onClick={props.onAgain}
      >
        {props.actionType === 'withdraw' ? 'Withdraw Again' : 'Deposit Again'}
      </Button>
    </>
  );
};

export const FailureScreen: React.FC<{
  icon?: React.ReactNode;
  message: string;
  onBack: () => void;
  onRetry: () => void;
}> = props => {
  return (
    <>
      <button
        type="button"
        onClick={props.onBack}
        aria-label="Back"
        className="text-foreground/80 hover:bg-foreground/10 w-fit rounded-full p-1"
      >
        <ArrowLeft className="text-foreground size-4" />
      </button>
      <div className="my-auto flex flex-col items-center gap-3 rounded-xl px-5 py-6">
        <div className="text-sm font-semibold">Transaction Failed</div>
        <div className="bg-destructive/10 flex size-24 items-center justify-center rounded-full">
          {props.icon || (
            <svg
              className="text-destructive size-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-sm">{props.message}</p>
        </div>
      </div>
      <Button
        className="text-md mt-auto w-full font-medium"
        size="lg"
        onClick={props.onRetry}
      >
        Try Again
      </Button>
    </>
  );
};
