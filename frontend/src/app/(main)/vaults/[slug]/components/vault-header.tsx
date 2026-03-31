'use client';

import { PageTitle } from '../../../components/page-title';

export function VaultHeader({ name }: { name: string }) {
  return <PageTitle title={name} />;
}
