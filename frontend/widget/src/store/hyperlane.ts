import {
  chainAddresses,
  chainMetadata,
  GithubRegistry,
  IRegistry,
  PartialRegistry,
} from "@hyperlane-xyz/registry";
import {
  ChainMap,
  ChainMetadata,
  ChainName,
  MultiProtocolProvider,
  WarpCore,
  WarpCoreConfig,
} from "@hyperlane-xyz/sdk";
import { create } from "zustand";

import { assembleChainMetadata } from "../lib/chains/metadata";
import { TokenChainMap } from "../lib/types";
import { assembleTokensBySymbolChainMap } from "../lib/utils";
import { assembleWarpCoreConfig } from "../lib/warpCore/warpCoreConfig";
import { logger } from "../utils/logger";

interface WarpContext {
  registry: IRegistry;
  chainMetadata: ChainMap<ChainMetadata>;
  multiProvider: MultiProtocolProvider;
  warpCore: WarpCore;
  tokensBySymbolChainMap: Record<string, TokenChainMap>;
  routerAddressesByChainMap: Record<ChainName, Set<string>>;
}

export interface AppState {
  // Chains and providers
  chainMetadata: ChainMap<ChainMetadata>;
  multiProvider: MultiProtocolProvider;
  registry: IRegistry;
  warpCore: WarpCore;
  setWarpContext: (context: WarpContext) => void;
  initializeWarpContext: () => Promise<void>;

  originChainName: ChainName;
  setOriginChainName: (originChainName: ChainName) => void;
  tokensBySymbolChainMap: Record<string, TokenChainMap>;
  // this map is currently used by the transfer token form validation to prevent
  // users from sending funds to a warp route address in a given destination chain
  routerAddressesByChainMap: Record<ChainName, Set<string>>;
}

export const useHyperlaneStore = create<AppState>()((set, get) => ({
  // Chains and providers
  chainMetadata: {},
  multiProvider: new MultiProtocolProvider({}),
  registry: new GithubRegistry({
    uri: `https://github.com/celestiaorg/hyperlane-ops`,
  }),
  warpCore: new WarpCore(new MultiProtocolProvider({}), []),
  setWarpContext: (context) => {
    logger.debug("Setting warp context in store");
    set(context);
  },
  initializeWarpContext: async () => {
    logger.debug("Initializing warp context");
    try {
      const state = get();
      const context = await initWarpContext(state);
      state.setWarpContext(context);
      logger.debug("Warp context initialization complete");
    } catch (error) {
      logger.error("Error during warp context initialization", error);
    }
  },
  originChainName: "",
  setOriginChainName: (originChainName: ChainName) => {
    set(() => ({ originChainName }));
  },
  tokensBySymbolChainMap: {},
  routerAddressesByChainMap: {},
}));

async function initWarpContext({
  registry,
}: {
  registry: IRegistry;
}): Promise<WarpContext> {
  let currentRegistry = registry;
  try {
    // Pre-load registry content to avoid repeated requests
    await currentRegistry.listRegistryContent();
  } catch (error) {
    currentRegistry = new PartialRegistry({
      chainAddresses: chainAddresses,
      chainMetadata: chainMetadata,
    });
    logger.warn(
      "Failed to list registry content using GithubRegistry, will continue with PartialRegistry.",
      error,
    );
  }
  try {
    const coreConfig = await assembleWarpCoreConfig(currentRegistry);

    const chainsInTokens = Array.from(
      new Set(coreConfig.tokens.map((t) => t.chainName)),
    );
    const { chainMetadata, chainMetadataWithOverrides } =
      await assembleChainMetadata(chainsInTokens, currentRegistry);
    const multiProvider = new MultiProtocolProvider(chainMetadataWithOverrides);
    const warpCore = WarpCore.FromConfig(multiProvider, coreConfig);

    const tokensBySymbolChainMap = assembleTokensBySymbolChainMap(
      warpCore.tokens,
      multiProvider,
    );
    const routerAddressesByChainMap = getRouterAddressesByChain(
      coreConfig.tokens,
    );
    return {
      registry,
      chainMetadata,
      multiProvider,
      warpCore,
      tokensBySymbolChainMap,
      routerAddressesByChainMap,
    };
  } catch (error) {
    logger.error("Error initializing warp context", error);
    return {
      registry,
      chainMetadata: {},
      multiProvider: new MultiProtocolProvider({}),
      warpCore: new WarpCore(new MultiProtocolProvider({}), []),
      tokensBySymbolChainMap: {},
      routerAddressesByChainMap: {},
    };
  }
}

// this weird type (WarpCoreConfig['tokens']) is to match what is being used in dedupeTokens at assembleWarpCoreConfig.ts
// returns a set with all the warp route addressOrDenom known to the registry
function getRouterAddressesByChain(
  tokens: WarpCoreConfig["tokens"],
): Record<ChainName, Set<string>> {
  return tokens.reduce<Record<ChainName, Set<string>>>((acc, token) => {
    acc[token.chainName] ||= new Set<string>();
    if (token.addressOrDenom) acc[token.chainName].add(token.addressOrDenom);
    return acc;
  }, {});
}
