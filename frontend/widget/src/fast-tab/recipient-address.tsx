import React, { useEffect, useMemo, useState } from "react";
import { isValidRecipientAddress } from "../lib/address-validation";
import { useRelayFlowStore } from "../store/swaps";

const RecipientAddress = () => {
  const { state, setToAddress } = useRelayFlowStore();
  const [recipientAddress, setRecipientAddress] = useState<string>(
    state.to.address || "",
  );
  const input = recipientAddress.trim();

  const isValidCustomAddress = useMemo(
    () => isValidRecipientAddress(input),
    [input],
  );

  const customAddressError =
    input && !isValidCustomAddress && "The entered address is invalid";

  const effectiveAddress = useMemo(() => {
    return isValidCustomAddress ? input : "";
  }, [input, isValidCustomAddress]);

  useEffect(() => {
    setToAddress(effectiveAddress);
  }, [effectiveAddress, setToAddress]);

  return (
    <div className="flex flex-col gap-1 mb-3">
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
      {customAddressError && (
        <div className="text-sm text-amber-600">{customAddressError}</div>
      )}
    </div>
  );
};

export default RecipientAddress;
