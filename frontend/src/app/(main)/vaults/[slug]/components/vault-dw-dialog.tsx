'use client';

import BigNumber from 'bignumber.js';

import React, { useMemo, useState } from 'react';

import { useParams, usePathname } from 'next/navigation';

import { useVaultDeposit } from '@/hooks/use-balances';
import { useVaultInfo } from '@/hooks/use-vault-data';

import { DynamicSheetDialog } from '@/components/dynamic-sheet/dialog';
import { Button } from '@/components/ui/button';
import VaultWidget, { VaultWidgetTab } from '@/components/vault-widget';

import { isNestedRoute } from '@/app/(main)/components/sidebar/items';

import { vaults } from '../../data';

const VaultDepositWithdrawDialog = () => {
  const params = useParams();
  const slug = params.slug;
  const vault = vaults[slug as `0x${string}`];
  const pathname = usePathname();
  const isNested = useMemo(() => isNestedRoute(pathname), [pathname]);
  const [dialogConfig, setDialogConfig] = useState<{
    showDialog: boolean;
    type: VaultWidgetTab | undefined;
  }>({
    showDialog: false,
    type: undefined,
  });
  const { vaultAsset } = useVaultInfo(vault);
  const { data: vaultBalance } = useVaultDeposit(
    vault?.address as `0x${string}`,
    vaultAsset
  );

  if (!vault || !isNested) {
    return null;
  }

  return (
    <>
      <div className="bg-background relative z-10 mt-5 flex w-full items-center gap-4 rounded-4xl px-6 py-4 shadow-[0_0_4px_0_rgba(0,0,0,0.25)] lg:!hidden">
        <Button
          className="flex-1/2 transition-all hover:scale-105"
          onClick={() => setDialogConfig({ showDialog: true, type: 'deposit' })}
        >
          Deposit
        </Button>
        {vaultBalance && new BigNumber(vaultBalance).isGreaterThan(0) ? (
          <Button
            variant="outline"
            className="hover:!text-primary-foreground bg-card hover:!bg-card flex-1/2 !border-none transition-all hover:scale-105"
            onClick={() =>
              setDialogConfig({ showDialog: true, type: 'withdraw' })
            }
          >
            Withdraw
          </Button>
        ) : null}
      </div>

      <DynamicSheetDialog
        showCloseIcon={true}
        open={dialogConfig.showDialog}
        sheetClassName="bg-black/80"
        onOpenChange={() =>
          setDialogConfig({ showDialog: false, type: undefined })
        }
        title={dialogConfig.type === 'deposit' ? 'Deposit' : 'Withdraw'}
      >
        <VaultWidget
          className="!w-full !shadow-none"
          defaultTab={dialogConfig.type}
          vault={vault}
        />
      </DynamicSheetDialog>
    </>
  );
};

export default VaultDepositWithdrawDialog;
