'use client';

import { ArrowRight } from '@phosphor-icons/react';
import BigNumber from 'bignumber.js';
import { motion } from 'framer-motion';
import { parseUnits, publicActions } from 'viem';
import { useWalletClient } from 'wagmi';

import { useMemo, useState } from 'react';

import { useBalances, useVaultDeposit } from '@/hooks/use-balances';
import { useVaultInfo } from '@/hooks/use-vault-data';

import { edenBlockscoutTxBaseUrl } from '@/lib/constants/eden-network';
import { IERC20_ABI, IMetaMorpho_ABI } from '@/lib/constants/vault-abi';
import { Vault } from '@/lib/types';
import { cn, formatAmount } from '@/lib/utils';
import { useWalletConnectStore } from '@/store/wallet-connect';

import { ConnectButtonFull } from '../connect-wallet-button';
import { Button } from '../ui/button';
import { AmountCard } from './components/amount-card';
import {
  FailureScreen,
  SuccessScreen,
  TxnProcessing,
} from './components/transaction-screens';

const getButtonText = (opts: {
  inputAmount: number;
  isInsufficientBalance: boolean;
  actionType?: 'deposit' | 'withdraw';
}): string | React.ReactNode => {
  if (!opts.inputAmount) {
    return 'Enter amount';
  }
  if (opts.isInsufficientBalance) {
    return 'Insufficient balance';
  }
  return opts.actionType === 'withdraw' ? 'Withdraw' : 'Deposit';
};

const TabItem: React.FC<{
  icon?: React.ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, title, isActive, onClick }) => {
  return (
    <Button
      className={cn(
        'flex items-center gap-2 rounded-[12px] border px-4 py-3 transition-all hover:scale-105',
        { 'text-primary-foreground': isActive },
        { 'hover:!text-foreground hover:!bg-transparent': !isActive }
      )}
      onClick={onClick}
      variant={isActive ? 'default' : 'outline'}
    >
      {icon}
      <p className="text-sm font-medium">{title}</p>
    </Button>
  );
};

const VaultInfo = (props: {
  asset?: { logoURI?: string; symbol?: string };
  amount?: string;
  depositAmount?: BigNumber;
  actionType: VaultWidgetTab;
}) => {
  return (
    <div className="bg-card-foreground mt-4 flex w-full flex-col rounded-xl px-4 py-6 text-xs">
      <p>Your Position</p>
      <div className="mt-4 flex items-center justify-between">
        <p>{`Deposit (${props.asset?.symbol})`}</p>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">
            {formatAmount(props.depositAmount || '0', 2, 2)}
          </span>
          {props.amount ? (
            <>
              <ArrowRight />
              <span>
                {' '}
                {props.actionType === 'withdraw' ? '- ' : ''}
                {props.amount}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p>Projected Earnings / Month (USD)</p>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">$0</span>
          <ArrowRight />
          <span>$0.15</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p>Projected Earnings / Year (USD)</p>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">$0</span>
          <ArrowRight />
          <span>$15</span>
        </div>
      </div>
    </div>
  );
};

const CTASection: React.FC<{
  children: React.ReactNode;
}> = props => {
  const { evm } = useWalletConnectStore();
  if (!evm) {
    return (
      <ConnectButtonFull
        buttonProps={{
          size: 'lg',
          className:
            'mt-auto w-full hover:scale-102 hover:disabled:scale-100 font-medium text-md',
        }}
      />
    );
  }
  return props.children;
};

export type VaultWidgetTab = 'deposit' | 'withdraw';

const VaultWidget = (props: {
  className?: string;
  defaultTab?: VaultWidgetTab;
  vault: Vault;
}) => {
  const { vaultAsset } = useVaultInfo(props.vault);
  const [currentTabId, setCurrentTabId] = useState<VaultWidgetTab>(
    props.defaultTab || 'deposit'
  );
  const [amount, setAmount] = useState('');
  const { data: evmWalletClient } = useWalletClient();
  const [widgetState, setWidgetState] = useState<{
    status: 'input' | 'approving' | 'success' | 'failure';
    data: null | { txHash: string };
  }>({
    status: 'input',
    data: null,
  });
  const [failureMessage, setFailureMessage] = useState('');
  const [displayFormat, setDisplayFormat] = useState('token');

  const handleTabClick = (tabId: VaultWidgetTab) => {
    setCurrentTabId(tabId);
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
  };

  const { data: vaultBalance, isLoading: isVaultBalanceLoading } =
    useVaultDeposit(props.vault.address as `0x${string}`, vaultAsset);

  const { data: balances, isLoading: isTokenBalanceLoading } = useBalances(
    evmWalletClient?.account.address
  );

  const balanceData = useMemo(() => {
    if (currentTabId === 'deposit') {
      if (!balances || !vaultAsset) return undefined;
      const balance = balances.find(
        b => b.token.address_hash === vaultAsset.address_hash
      );
      return {
        vaultTokenBalance: balance
          ? new BigNumber(balance.value).dividedBy(
              new BigNumber(10).pow(vaultAsset.decimals || 18)
            )
          : new BigNumber(0),
        isBalanceLoading: isTokenBalanceLoading,
      };
    }
    return {
      vaultTokenBalance: vaultBalance,
      isBalanceLoading: isVaultBalanceLoading,
    };
  }, [
    balances,
    vaultAsset,
    vaultBalance,
    isVaultBalanceLoading,
    currentTabId,
    isTokenBalanceLoading,
  ]);

  const handleSubmit = async () => {
    setWidgetState({
      status: 'approving',
      data: null,
    });
    if (!evmWalletClient) return;
    const extendedSigner = evmWalletClient.extend(publicActions);

    if (currentTabId === 'deposit') {
      await executeDeposit(evmWalletClient, extendedSigner);
      return;
    }
    if (currentTabId === 'withdraw') {
      await executeWithdraw(extendedSigner);
      return;
    }
  };

  const executeDeposit = async (walletClient: any, signer: any) => {
    const vaultAddress = props.vault.address as `0x${string}`;
    const vaultAssetAddress = vaultAsset?.address_hash as `0x${string}`;

    const allowance = await signer.readContract({
      address: vaultAssetAddress,
      abi: IERC20_ABI, // A standard ERC20 ABI
      functionName: 'allowance',
      args: [walletClient.account.address, vaultAddress],
    });

    const amountToDeposit = parseUnits(
      amount,
      Number(vaultAsset?.decimals as string)
    ); // Example: 1 WETH
    try {
      if (allowance < amountToDeposit) {
        const { request } = await signer.simulateContract({
          address: vaultAssetAddress,
          abi: IERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress, amountToDeposit],
        });
        await signer.writeContract(request);
      }

      console.log('Allowance is sufficient, simulating deposit...');

      const { request: depositRequest } = await signer.simulateContract({
        address: vaultAddress,
        abi: IMetaMorpho_ABI,
        functionName: 'deposit',
        args: [amountToDeposit, evmWalletClient?.account.address], // (assets, receiver)
      });
      console.log({ depositRequest });
      const depositTxHash = await signer.writeContract(depositRequest);
      console.log('Deposit successful:', depositTxHash);
      setWidgetState({
        status: 'success',
        data: { txHash: depositTxHash },
      });
    } catch (error: any) {
      console.error('Error during deposit:', error);
      setFailureMessage('Transaction failed. Please try again.');
      setWidgetState({
        status: 'failure',
        data: null,
      });
      return;
    }
  };

  const executeWithdraw = async (signer: any) => {
    const vaultAddress = props.vault.address as `0x${string}`;

    const amountToWithdraw = parseUnits(
      amount,
      Number(vaultAsset?.decimals as string)
    ); // Example: 1 WETH
    try {
      const { request: withdrawRequest } = await signer.simulateContract({
        address: vaultAddress,
        abi: IMetaMorpho_ABI,
        functionName: 'withdraw',
        args: [
          amountToWithdraw,
          evmWalletClient?.account.address,
          evmWalletClient?.account.address,
        ], // (assets, receiver)
      });
      console.log({ withdrawRequest });
      const withdrawTxHash = await signer.writeContract(withdrawRequest);
      console.log('Withdraw successful:', withdrawTxHash);
      setWidgetState({
        status: 'success',
        data: { txHash: withdrawTxHash },
      });
    } catch (error: any) {
      console.error('Error during withdraw:', error);
      setFailureMessage('Transaction failed. Please try again.');
      setWidgetState({
        status: 'failure',
        data: null,
      });
      return;
    }
  };

  const handleReset = () => {
    setWidgetState({
      status: 'input',
      data: null,
    });
    setAmount('');
    setFailureMessage('');
  };

  const handleRetry = () => {
    setWidgetState({
      status: 'input',
      data: null,
    });
    setFailureMessage('');
  };

  const isInsufficientBalance = useMemo(() => {
    if (!amount || !balanceData?.vaultTokenBalance) return false;
    const inputAmount = new BigNumber(amount);
    return inputAmount.isGreaterThan(balanceData.vaultTokenBalance);
  }, [amount, balanceData?.vaultTokenBalance]);
  const buttonText = getButtonText({
    inputAmount: parseFloat(amount) || 0,
    isInsufficientBalance,
    actionType: currentTabId as 'deposit' | 'withdraw',
  });

  return (
    <motion.div
      key="bridge-view"
      initial="hidden"
      animate="visible"
      exit="hidden"
      className={cn(
        `bg-background relative z-0 flex h-[640px] w-[440px] flex-col justify-center rounded-3xl p-4 shadow-sm sm:p-8`,
        props.className
      )}
    >
      {widgetState.status === 'success' ? (
        <SuccessScreen
          amount={amount}
          actionType={currentTabId as 'deposit' | 'withdraw'}
          onBack={handleReset}
          asset={vaultAsset}
          explorerLink={
            widgetState.data?.txHash
              ? `${edenBlockscoutTxBaseUrl}/tx/${widgetState.data?.txHash}`
              : undefined
          }
          onAgain={handleReset}
        />
      ) : widgetState.status === 'failure' ? (
        <FailureScreen
          message={failureMessage || 'Transaction failed. Please try again.'}
          onBack={handleReset}
          onRetry={handleRetry}
        />
      ) : (
        <>
          {widgetState.status === 'input' ? (
            props?.defaultTab ? null : (
              <div className="mb-6 flex items-center gap-3">
                <TabItem
                  title="Deposit"
                  isActive={currentTabId === 'deposit'}
                  onClick={() => handleTabClick('deposit')}
                />
                <TabItem
                  title="Withdraw"
                  isActive={currentTabId === 'withdraw'}
                  onClick={() => handleTabClick('withdraw')}
                />
              </div>
            )
          ) : (
            <div className="mb-6 text-sm">Transaction in progress</div>
          )}
          <AmountCard
            label={currentTabId === 'deposit' ? 'You deposit' : 'You withdraw'}
            value={amount}
            onChange={handleAmountChange}
            disabled={widgetState.status === 'approving'}
            assetDetails={vaultAsset}
            tokenBalance={balanceData?.vaultTokenBalance}
            isBalanceLoading={balanceData?.isBalanceLoading}
          />
          {widgetState.status === 'input' ? (
            <VaultInfo
              asset={vaultAsset}
              amount={amount}
              depositAmount={vaultBalance}
              actionType={currentTabId}
            />
          ) : null}
          <CTASection>
            {widgetState.status === 'input' ? (
              <Button
                className={cn(
                  'text-md mt-auto w-full font-medium transition-all hover:scale-105',
                  isInsufficientBalance ? '!bg-destructive/90 text-white' : ''
                )}
                size="lg"
                onClick={handleSubmit}
                disabled={isInsufficientBalance || !amount}
              >
                {buttonText}
              </Button>
            ) : (
              <TxnProcessing />
            )}
          </CTASection>
        </>
      )}
    </motion.div>
  );
};

export default VaultWidget;
export { TxnProcessing };
