import { useCallback, useEffect, useState } from "react";

import { hexToDecimal } from "../lib/utils";

export type CelestialResolutionError = "no_address" | "not_verified" | null;

interface UseCelestialDomainReturn {
  resolvedAddress: string;
  isResolving: boolean;
  isChainSupported: boolean;
  resolutionError: CelestialResolutionError;
  supportedChains: {
    name: string;
    chain_id: string;
  }[];
}

export const useCelestialDomain = (
  address: string,
  destinationChainId: string,
): UseCelestialDomainReturn => {
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] =
    useState<CelestialResolutionError>(null);
  const [supportedChains, setSupportedChains] = useState<
    {
      name: string;
      chain_id: string;
    }[]
  >([]);

  const getSupportedChains = async () => {
    try {
      const response = await fetch(
        "https://api.celestials.id/api/resolver/chains",
      );
      if (!response.ok) {
        throw new Error("Failed to fetch supported chains");
      }
      const data = await response.json();
      return data.chains || [];
    } catch (error) {
      console.error("Error fetching supported chains:", error);
      return [];
    }
  };

  const resolveIdAddress = useCallback(
    async (idString: string, chainId: string) => {
      if (!idString.endsWith(".i")) return;

      // Check if destination chain supports Celestial domains
      const chainIsSupported = supportedChains.findIndex(
        (chain) => hexToDecimal(chain.chain_id) === chainId,
      );
      if (chainIsSupported === -1) {
        setResolvedAddress("");
        setResolutionError(null);
        return;
      }

      const username = idString.replace(".i", "");
      setIsResolving(true);
      setResolutionError(null);

      try {
        const response = await fetch(
          "https://api.celestials.id/api/resolver/lookup",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              celestial_chain: [
                {
                  celestials_id: username,
                  chain_id: supportedChains[chainIsSupported].chain_id,
                },
              ],
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to resolve address");
        }

        const data = await response.json();

        if (data.addresses && data.addresses.length > 0) {
          const chainAddress =
            data.addresses[0]?.status === "VERIFIED" ? data.addresses[0] : null;
          if (chainAddress) {
            setResolvedAddress(chainAddress.address);
            setResolutionError(null);
          } else {
            setResolvedAddress("");
            setResolutionError("not_verified");
          }
        } else {
          setResolvedAddress("");
          setResolutionError("no_address");
        }
      } catch (error) {
        console.error("Error resolving .i address:", error);
        setResolvedAddress("");
        setResolutionError("no_address");
      } finally {
        setIsResolving(false);
      }
    },
    [supportedChains],
  );

  useEffect(() => {
    getSupportedChains().then((chains) => {
      setSupportedChains(chains);
    });
  }, []);

  useEffect(() => {
    if (address && address.endsWith(".i") && supportedChains.length > 0) {
      const chainSupported = supportedChains.find(
        (chain) => hexToDecimal(chain.chain_id) === destinationChainId,
      );
      if (!chainSupported) {
        setResolvedAddress("");
        setResolutionError(null);
        return;
      }
      resolveIdAddress(address, destinationChainId);
    } else {
      setResolvedAddress("");
      setResolutionError(null);
    }
  }, [address, destinationChainId, supportedChains, resolveIdAddress]);

  const isChainSupported = !!supportedChains.find(
    (chain) => hexToDecimal(chain.chain_id) === destinationChainId,
  );

  return {
    resolvedAddress,
    isResolving,
    isChainSupported,
    resolutionError,
    supportedChains,
  };
};
