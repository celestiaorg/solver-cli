import React, { useEffect, useMemo, useState } from "react";
import { useCelestialDomain } from "../hooks/use-celestial-domain";
import { isValidRecipientAddress } from "../lib/address-validation";
import { useHyperlaneFlowStore } from "../store/bridge";

const RecipientAddress = () => {
  const { state, setToAddress } = useHyperlaneFlowStore();
  const [recipientAddress, setRecipientAddress] = useState<string>(
    state.to.address || "",
  );
  const input = recipientAddress.trim();
  const isCelestialDomain = input.endsWith(".i");
  const { resolvedAddress, isResolving, isChainSupported, resolutionError } =
    useCelestialDomain(input, String(state.to.chain?.key || ""));

  const isValidCustomAddress = useMemo(
    () => !isCelestialDomain && isValidRecipientAddress(input),
    [input, isCelestialDomain],
  );

  const customAddressError =
    input &&
    !isCelestialDomain &&
    !isResolving &&
    !isValidCustomAddress &&
    "The entered address is invalid";

  const effectiveAddress = useMemo(() => {
    if (isCelestialDomain) {
      if (resolutionError === null && resolvedAddress) return resolvedAddress;
      return "";
    }
    return isValidCustomAddress ? input : "";
  }, [
    isCelestialDomain,
    resolutionError,
    resolvedAddress,
    input,
    isValidCustomAddress,
  ]);

  useEffect(() => {
    setToAddress(effectiveAddress);
  }, [effectiveAddress, setToAddress]);

  const celestialChainNotSupported =
    isCelestialDomain && !isChainSupported && !isResolving;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="recipient-address"
        className="text-foreground-2 text-sm font-medium"
      >
        Recipient Address{" "}
        <span className="text-foreground-3 text-xs">(optional)</span>
      </label>
      <input
        id="recipient-address"
        type="text"
        placeholder="Enter recipient address (optional)"
        className="border-card-surface-2 bg-card-surface focus:border-primary w-full rounded-md border px-3 py-2 text-base outline-none"
        value={recipientAddress}
        onChange={(e) => setRecipientAddress(e.target.value)}
      />
      {isCelestialDomain && (
        <>
          {isResolving && (
            <div className="text-foreground-3 text-sm">
              Resolving address...
            </div>
          )}
          {celestialChainNotSupported && (
            <div className="text-sm text-amber-600">
              Celestial domains not supported for this destination chain
            </div>
          )}
          {!isResolving &&
            isChainSupported &&
            resolutionError === "no_address" && (
              <div className="text-sm text-amber-600">
                No associated address found
              </div>
            )}
          {!isResolving &&
            isChainSupported &&
            resolutionError === "not_verified" && (
              <div className="text-sm text-amber-600">
                Wallet address is not verified
              </div>
            )}
          {!isResolving && resolvedAddress && (
            <div className="text-foreground-2 bg-background rounded-md px-3 py-2 text-sm">
              <span className="text-foreground-3">Resolved address: </span>
              <span className="font-mono">{resolvedAddress}</span>
            </div>
          )}
        </>
      )}
      {customAddressError && (
        <div className="text-sm text-amber-600">{customAddressError}</div>
      )}
    </div>
  );
};

export default RecipientAddress;
