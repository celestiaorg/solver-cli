'use client';

import { useEffect } from 'react';

import { useHeader } from './header';

export function PageTitle({ title }: { title: string }) {
  const { setNestedTitle } = useHeader();

  useEffect(() => {
    setNestedTitle(title);
    return () => setNestedTitle(null);
  }, [title, setNestedTitle]);

  return null;
}
