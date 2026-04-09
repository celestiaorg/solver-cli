import { ChainMap } from "@hyperlane-xyz/sdk";
import { ProtocolType } from "@hyperlane-xyz/utils";

const isDevMode =
  import.meta.env.MODE === "development" ||
  import.meta.env.VITE_NODE_ENV === "development";
const version = import.meta.env.VITE_VERSION || "0.0.0";
const registryUrl =
  import.meta.env.VITE_REGISTRY_URL ||
  "https://api.github.com/repos/celestiaorg/hyperlane-ops";
const registryBranch = import.meta.env.VITE_REGISTRY_BRANCH || "main";
const registryProxyUrl =
  import.meta.env.VITE_GITHUB_PROXY || "https://proxy.hyperlane.xyz";
const walletConnectProjectId = import.meta.env.VITE_WALLET_CONNECT_ID || "";
const transferBlacklist = import.meta.env.VITE_TRANSFER_BLACKLIST || "";
const chainWalletWhitelists = JSON.parse(
  import.meta.env.VITE_CHAIN_WALLET_WHITELISTS || "{}",
);
const rpcOverrides = import.meta.env.VITE_RPC_OVERRIDES || "";
const leapApiBaseUrl = import.meta.env.VITE_LEAP_API_BASE_URL || undefined;

interface Config {
  // addressBlacklist: string[]; // A list of addresses that are blacklisted and cannot be used in the app
  chainWalletWhitelists: ChainMap<string[]>; // A map of chain names to a list of wallet names that work for it
  defaultOriginChain: string | undefined; // The initial origin chain to show when app first loads
  defaultDestinationChain: string | undefined; // The initial destination chain to show when app first loads
  enableExplorerLink: boolean; // Include a link to the hyperlane explorer in the transfer modal
  isDevMode: boolean; // Enables some debug features in the app
  registryUrl: string | undefined; // Optional URL to use a custom registry instead of the published canonical version
  registryBranch?: string | undefined; // Optional customization of the registry branch instead of main
  registryProxyUrl?: string; // Optional URL to use a custom proxy for the GithubRegistry
  showAddRouteButton: boolean; // Show/Hide the add route config icon in the button strip
  showAddChainButton: boolean; // Show/Hide add custom chain in the chain search menu
  showDisabledTokens: boolean; // Show/Hide invalid token options in the selection modal
  showTipBox: boolean; // Show/Hide the blue tip box above the transfer form
  shouldDisableChains: boolean; // Enable chain disabling for ChainSearchMenu. When true it will deactivate chains that have disabled status
  transferBlacklist: string; // comma-separated list of routes between which transfers are disabled. Expects Caip2Id-Caip2Id (e.g. ethereum:1-sealevel:1399811149)
  version: string; // Matches version number in package.json
  walletConnectProjectId: string; // Project ID provided by walletconnect
  walletProtocols: ProtocolType[] | undefined; // Wallet Protocols to show in the wallet connect modal. Leave undefined to include all of them
  rpcOverrides: string; // JSON string containing a map of chain names to an object with an URL for RPC overrides (For an example check the .env.example file)
  leapApiBaseUrl?: string; // Optional base URL for the Leap API
}

export const config: Config = Object.freeze({
  chainWalletWhitelists,
  enableExplorerLink: false,
  defaultOriginChain: undefined,
  defaultDestinationChain: undefined,
  isDevMode,
  registryUrl,
  registryBranch,
  registryProxyUrl,
  showAddRouteButton: true,
  showAddChainButton: true,
  showDisabledTokens: false,
  showTipBox: true,
  version,
  transferBlacklist,
  walletConnectProjectId,
  walletProtocols: [
    ProtocolType.Ethereum,
    ProtocolType.Sealevel,
    ProtocolType.Cosmos,
  ],
  shouldDisableChains: false,
  rpcOverrides,
  leapApiBaseUrl,
});
