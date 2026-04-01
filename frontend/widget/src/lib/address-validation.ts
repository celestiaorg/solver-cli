import { PublicKey } from "@solana/web3.js";
import { bech32 } from "bech32";
import { isAddress } from "viem";

function isValidBech32Address(value: string): boolean {
  if (!value || value.length < 20) return false;
  try {
    const decoded = bech32.decode(value);
    return decoded.prefix.length > 0 && decoded.prefix.startsWith("celestia");
  } catch {
    return false;
  }
}

function isValidEvmAddress(value: string): boolean {
  try {
    return isAddress(value, { strict: false });
  } catch {
    return false;
  }
}

function isValidSolanaAddress(value: string): boolean {
  try {
    const key = new PublicKey(value);
    return key.toBase58().length >= 32 && key.toBase58().length <= 44;
  } catch {
    return false;
  }
}

export function isValidRecipientAddress(value: string): boolean {
  if (!value || !value.trim()) return false;
  const trimmed = value.trim();
  return (
    isValidBech32Address(trimmed) ||
    isValidEvmAddress(trimmed) ||
    isValidSolanaAddress(trimmed)
  );
}
