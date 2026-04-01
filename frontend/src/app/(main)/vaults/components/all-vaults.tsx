import { Vault } from '@/lib/types';

import { VaultTable } from './vault-table';

export const AllVaults = ({ data }: { data: Vault[] }) => {
  return <VaultTable data={data} />;
};
