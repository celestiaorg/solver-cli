/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VERSION?: string;
  readonly VITE_REGISTRY_URL?: string;
  readonly VITE_REGISTRY_BRANCH?: string;
  readonly VITE_GITHUB_PROXY?: string;
  readonly VITE_WALLET_CONNECT_ID?: string;
  readonly VITE_TRANSFER_BLACKLIST?: string;
  readonly VITE_CHAIN_WALLET_WHITELISTS?: string;
  readonly VITE_RPC_OVERRIDES?: string;
  readonly VITE_LEAP_API_BASE_URL?: string;
  readonly VITE_NODE_ENV?: string;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
