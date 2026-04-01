'use client';

import React from 'react';

import { usePathname } from 'next/navigation';

import { edenImages } from '@/lib/constants/eden-images';

export const DynamicBackground = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <div
      className={`md:p-10'} relative flex min-h-dvh flex-col bg-cover bg-center p-3`}
      style={{
        backgroundImage: `url(${isHomePage ? edenImages.image7 : edenImages.image2})`,
      }}
    >
      <div className="absolute top-0 right-0 bottom-0 left-0 z-1 h-full w-full bg-black opacity-70" />
      {children}
    </div>
  );
};
