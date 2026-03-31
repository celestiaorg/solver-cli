export const APP_ORIGIN = `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}`;

export const walletConnectProjectId = '6b99a6197e7a11fea2be0e66232153c5';
export const web3ModalConfig = {
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string,
  walletConnectVersion: 2,
  enableExplorer: true,
  explorerRecommendedWalletIds: [
    '3ed8cc046c6211a798dc5ec70f1302b43e07db9639fd287de44a9aa115a21ed6', // leap
    '123e6d19e6c0f575b148c469eb191f8b92618c13c94c4758aee35e042e37fa21', // compass
    '6adb6082c909901b9e7189af3a4a0223102cd6f8d5c39e39f3d49acb92b578bb', // keplr
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // metamask
    'feb6ff1fb426db18110f5a80c7adbde846d0a7e96b2bc53af4b73aaf32552bea', // cosmostation
    '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', // okx
    'f896cbca30cd6dc414712d3d6fcc2f8f7d35d5bd30e3b1fc5d60cf6c8926f98f', // xdefi
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // phantom
    '1ca0bdd4747578705b1939af023d120677c64fe6ca76add81fda36e350605e79', // solflare
    'afbd95522f4041c71dd4f1a065f971fd32372865b416f95a0b1db759ae33f2a7', // omni wallet
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // coinbase
  ],
};

export const walletConnectOptions = {
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string,
  metadata: {
    name: 'Bridge Page',
    description: '',
    url: APP_ORIGIN,
    icons: [`${APP_ORIGIN}/icon.png`],
  },
};
