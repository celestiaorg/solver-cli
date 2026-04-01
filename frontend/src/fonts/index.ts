import localFont from 'next/font/local';

export const aeonik = localFont({
  variable: '--font-aeonik',
  preload: true,
  src: [
    {
      path: './Aeonik-Bold.woff2',
      weight: '700',
      style: 'bold',
    },
    {
      path: './Aeonik-Regular.woff2',
      weight: '500',
      style: 'medium',
    },
    {
      path: './Aeonik-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
});
