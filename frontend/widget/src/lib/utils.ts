import { cosmoshub } from "@hyperlane-xyz/registry";
import {
  ChainMap,
  ChainMetadata,
  ChainName,
  ChainStatus,
  CoreAddresses,
  IToken,
  MultiProtocolCore,
  MultiProtocolProvider,
  ProviderType,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  TypedTransactionReceipt,
  WarpCore,
} from "@hyperlane-xyz/sdk";
import {
  eqAddress,
  isHttpsUrl,
  isRelativeUrl,
  normalizeAddress,
  ProtocolType,
  toTitleCase,
} from "@hyperlane-xyz/utils";
import BigNumber from "bignumber.js";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { logger } from "../utils/logger";

import { config } from "../lib/constants/config";
import { links } from "./constants/links";
import { ChainVM, RelayChainId } from "./relay-api";
import {
  ChainData,
  MultiCollateralTokenMap,
  SupportedChain,
  TokenChainMap,
} from "./types";

const DIGIT_CHECKER_REGEX = /^\d*\.?\d*$/;

export const sliceAddress = (
  address: string | undefined,
  visibleLetters = 5,
) => {
  if (!address) return "";

  return (
    address.slice(0, visibleLetters) +
    "..." +
    address.slice(address.length - visibleLetters, address.length)
  );
};

export const hexToDecimal = (hexString: string): string => {
  if (hexString.startsWith("0x")) {
    return parseInt(hexString, 16).toString();
  }
  return hexString;
};

export const tryCatch = async <TResponse, TError = Error>(
  promise: Promise<TResponse>,
): Promise<[TResponse, null] | [null, TError]> => {
  try {
    const res = await promise;
    return [res, null];
  } catch (error) {
    return [null, error as TError];
  }
};

export const tryCatchSync = <TResponse, TError = Error>(
  res: TResponse,
): [TResponse, null] | [null, TError] => {
  try {
    return [res, null];
  } catch (error) {
    return [null, error as TError];
  }
};

export const formatAmount = (
  amount: BigNumber.Value,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
  notation:
    | "standard"
    | "scientific"
    | "engineering"
    | "compact"
    | undefined = "standard",
) => {
  const x = new BigNumber(amount);
  const lowest = new BigNumber(10).pow(-maximumFractionDigits);

  if (x.isNaN()) {
    return "";
  }

  if (x.isZero()) {
    return "0";
  }

  if (x.isLessThan(lowest)) {
    return `< ${lowest}`;
  }

  const effectiveMinimumFractionDigits = x.isGreaterThanOrEqualTo(100)
    ? 2
    : minimumFractionDigits;

  return Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: notation,
    maximumFractionDigits: x.isGreaterThanOrEqualTo(100)
      ? effectiveMinimumFractionDigits
      : maximumFractionDigits,
    minimumFractionDigits: effectiveMinimumFractionDigits,
  })
    .format(x.toNumber())
    .slice(1);
};

export const formatAmountWithPrefix = (
  amount: BigNumber.Value,
  prefix: string,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
  notation:
    | "standard"
    | "scientific"
    | "engineering"
    | "compact"
    | undefined = "standard",
) => {
  const result = formatAmount(
    amount,
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
  );

  if (result.startsWith("<")) {
    return `< ${prefix}${result.slice(2)}`;
  }

  return `${prefix}${result}`;
};

export const isDigits = (value: string) => DIGIT_CHECKER_REGEX.test(value);

export function isTestnetApp() {
  return "window" in globalThis
    ? window.location.hostname.startsWith("testnet")
    : false;
}

export function isChainDisabled(chainMetadata: ChainMetadata | null) {
  if (!config.shouldDisableChains || !chainMetadata) return false;

  return chainMetadata.availability?.status === ChainStatus.Disabled;
}

export function getChainDisplayName(
  multiProvider: MultiProtocolProvider,
  chain: ChainName,
  shortName = false,
) {
  if (!chain) return "Unknown";
  const metadata = multiProvider.tryGetChainMetadata(chain);
  if (!metadata) return "Unknown";
  const displayName = shortName
    ? metadata.displayNameShort
    : metadata.displayName;
  return displayName || metadata.displayName || toTitleCase(metadata.name);
}

// Map of token symbols and token chain map
// Symbols are not duplicated to avoid the same symbol from being shown
// TokenChainMap: An object containing token information and a map
// chain names with its metadata and the related token
export function assembleTokensBySymbolChainMap(
  tokens: Token[],
  multiProvider: MultiProtocolProvider,
): Record<string, TokenChainMap> {
  const multiChainTokens = tokens.filter((t) => t.isMultiChainToken());
  return multiChainTokens.reduce<Record<string, TokenChainMap>>(
    (acc, token) => {
      if (!token.connections || !token.connections.length) return acc;

      if (!acc[token.symbol]) {
        acc[token.symbol] = {
          chains: {},
          tokenInformation: token,
        };
      }
      if (!acc[token.symbol].chains[token.chainName]) {
        const chainMetadata = multiProvider.tryGetChainMetadata(
          token.chainName,
        );

        // remove chain from map if it is disabled
        const chainDisabled = isChainDisabled(chainMetadata);
        if (chainDisabled) return acc;

        acc[token.symbol].chains[token.chainName] = {
          token,
          metadata: chainMetadata,
        };
      }

      return acc;
    },
    {},
  );
}

export function isValidMultiCollateralToken(
  originToken: Token | IToken,
  destination: ChainName | IToken,
) {
  if (
    !originToken.collateralAddressOrDenom ||
    !TOKEN_COLLATERALIZED_STANDARDS.includes(originToken.standard)
  )
    return false;

  const destinationToken =
    typeof destination === "string"
      ? originToken.getConnectionForChain(destination)?.token
      : destination;

  if (
    !destinationToken ||
    !destinationToken.collateralAddressOrDenom ||
    !TOKEN_COLLATERALIZED_STANDARDS.includes(destinationToken.standard)
  )
    return false;

  return true;
}

export function getTokensWithSameCollateralAddresses(
  warpCore: WarpCore,
  origin: Token,
  destination: IToken,
) {
  const originCollateralAddress = origin.collateralAddressOrDenom
    ? normalizeAddress(origin.collateralAddressOrDenom, origin.protocol)
    : undefined;
  const destinationCollateralAddress = destination.collateralAddressOrDenom
    ? normalizeAddress(
        destination.collateralAddressOrDenom,
        destination.protocol,
      )
    : undefined;
  if (!originCollateralAddress || !destinationCollateralAddress) return [];

  return warpCore
    .getTokensForRoute(origin.chainName, destination.chainName)
    .map((originToken) => {
      const destinationToken = originToken.getConnectionForChain(
        destination.chainName,
      )?.token;
      return { originToken, destinationToken };
    })
    .filter(
      (tokens): tokens is { originToken: Token; destinationToken: Token } => {
        // doing this because annoying Typescript will have destinationToken
        // as undefined even if it is filtered out
        const { originToken, destinationToken } = tokens;

        if (!destinationToken) return false;
        const isMultiCollateralToken = isValidMultiCollateralToken(
          originToken,
          destinationToken,
        );
        if (!isMultiCollateralToken) return false;

        // asserting because isValidMultiCollateralToken already checks for existence of collateralAddressOrDenom
        const currentOriginCollateralAddress = normalizeAddress(
          originToken.collateralAddressOrDenom!,
          originToken.protocol,
        );
        const currentDestinationCollateralAddress = normalizeAddress(
          destinationToken.collateralAddressOrDenom!,
          destinationToken.protocol,
        );

        return (
          eqAddress(originCollateralAddress, currentOriginCollateralAddress) &&
          eqAddress(
            destinationCollateralAddress,
            currentDestinationCollateralAddress,
          )
        );
      },
    );
}

// De-duplicate collaterized tokens
// Returns a map of token with same origin and dest collateral address
// And an array of tokens with repeated collateral addresses grouped into one
export function dedupeMultiCollateralTokens(
  tokens: Token[],
  destination: ChainName,
) {
  return tokens.reduce<{
    tokens: Token[];
    multiCollateralTokenMap: MultiCollateralTokenMap;
  }>(
    (acc, t) => {
      const originToken = t as Token;
      const isMultiCollateralToken = isValidMultiCollateralToken(
        originToken,
        destination,
      );
      if (!isMultiCollateralToken)
        return { ...acc, tokens: [...acc.tokens, t] };

      // Non-Null asserting this because this is covered by isValidMultiCollateralToken and
      // the early return from above
      const destinationToken =
        originToken.getConnectionForChain(destination)!.token;
      const originAddress = normalizeAddress(
        originToken.collateralAddressOrDenom!,
        originToken.protocol,
      );
      const destinationAddress = normalizeAddress(
        destinationToken.collateralAddressOrDenom!,
        destinationToken.protocol,
      );

      // now origin and destination are both collaterals
      // create map for tokens with same origin and destination collateral addresses
      acc.multiCollateralTokenMap[originAddress] ||= {};
      if (!acc.multiCollateralTokenMap[originAddress][destinationAddress]) {
        acc.multiCollateralTokenMap[originAddress][destinationAddress] = [];
        acc.tokens.push(t);
      }

      acc.multiCollateralTokenMap[originAddress][destinationAddress].push(
        originToken,
      );
      return acc;
    },
    { tokens: [], multiCollateralTokenMap: {} },
  );
}

export function getImageSrc(url?: string | null) {
  if (!url) return null;
  // If it's a valid, direct URL, return it
  if (isHttpsUrl(url)) return url;
  // Otherwise assume it's a relative URL to the registry base
  if (isRelativeUrl(url)) return `${links.imgPath}${url}`;
  return null;
}

export function tryGetMsgIdFromTransferReceipt(
  multiProvider: MultiProtocolProvider,
  origin: ChainName,
  receipt: TypedTransactionReceipt,
) {
  try {
    // IBC transfers have no message IDs
    if (receipt.type === ProviderType.CosmJs) return undefined;

    if (receipt.type === ProviderType.Starknet) {
      receipt = {
        type: ProviderType.Starknet,
        receipt: receipt.receipt as any,
      };
    }

    if (receipt.type === ProviderType.Viem) {
      // Massage viem type into ethers type because that's still what the
      // SDK expects. In this case they're compatible.
      receipt = {
        type: ProviderType.EthersV5,
        receipt: receipt.receipt as any,
      };
    }

    const addressStubs = multiProvider
      .getKnownChainNames()
      .reduce<ChainMap<CoreAddresses>>((acc, chainName) => {
        // Actual core addresses not required for the id extraction
        acc[chainName] = {
          validatorAnnounce: "",
          proxyAdmin: "",
          mailbox: "",
        };
        return acc;
      }, {});
    const core = new MultiProtocolCore(multiProvider, addressStubs);
    const messages = core.extractMessageIds(origin, receipt);
    if (messages.length) {
      const msgId = messages[0].messageId;
      logger.debug("Message id found in logs", msgId);
      return msgId;
    } else {
      logger.warn("No messages found in logs");
      return undefined;
    }
  } catch (error) {
    logger.error("Could not get msgId from transfer receipt", error);
    return undefined;
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function findChainByRpcUrl(
  multiProvider: MultiProtocolProvider,
  url?: string,
) {
  if (!url) return undefined;
  const allMetadata = Object.values(multiProvider.metadata);
  const searchUrl = url.toLowerCase();
  return allMetadata.find(
    (m) =>
      !!m.rpcUrls.find((rpc) => rpc.http.toLowerCase().includes(searchUrl)),
  );
}

export function getChainsForProtocol(
  multiProvider: MultiProtocolProvider,
  protocol: ProtocolType,
): ChainMetadata[] {
  return Object.values(multiProvider.metadata).filter(
    (c) => c.protocol === protocol,
  );
}

export function getCosmosChains(
  multiProvider: MultiProtocolProvider,
): ChainMetadata[] {
  return [
    ...getChainsForProtocol(multiProvider, ProtocolType.Cosmos),
    ...getChainsForProtocol(multiProvider, ProtocolType.CosmosNative),
    cosmoshub,
  ];
}

export function getCosmosChainMetadata(
  multiProvider: MultiProtocolProvider,
): Record<ChainName, ChainMetadata> {
  const cosmosChains = getCosmosChains(multiProvider);
  return cosmosChains.reduce<Record<ChainName, ChainMetadata>>((acc, chain) => {
    acc[chain.name] = chain;
    return acc;
  }, {});
}

export const getDecimalPower10 = (decimals: number): BigNumber => {
  return new BigNumber(10).exponentiatedBy(decimals);
};

export function getRelayChainId(chainId: string) {
  let relayChainId = chainId;
  if (chainId === "solana") {
    relayChainId = RelayChainId.solana;
  }
  return Number(relayChainId);
}

export function parseRelayChainType(chainType?: ChainVM) {
  switch (chainType) {
    case "evm":
      return ProtocolType.Ethereum;
    case "svm":
      return ProtocolType.Sealevel;
    default:
      return undefined;
  }
}
export const getChainData = (chain: SupportedChain): ChainData => ({
  id: chain.chainId,
  displayName: chain.name,
  logoURI: getImageSrc(chain.logoURI) || undefined,
});
