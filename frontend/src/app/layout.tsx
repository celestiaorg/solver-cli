import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';

import { AppWrapper } from '@/components/app-wrapper';

import { aeonik } from '@/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Eden Portal',
  description: 'Multi-chain Web3 application built with Next.js',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="shortcut icon" href="/favicon.png" />
      </head>
      <body className={`${aeonik.className} flex h-dvh flex-col`}>
        <NextTopLoader color="#fff" height={3} showSpinner={false} />
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
