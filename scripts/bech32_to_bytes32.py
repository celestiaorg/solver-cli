#!/usr/bin/env python3
"""Convert a bech32 address to a 0x-prefixed bytes32 (left-padded with zeros)."""
import sys

CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

def bech32_decode(addr):
    """Decode bech32 address to raw bytes."""
    # Split at last '1'
    pos = addr.rfind('1')
    if pos < 1:
        raise ValueError(f"Invalid bech32: {addr}")
    data_part = addr[pos + 1:]
    # Remove 6-char checksum
    values = [CHARSET.index(c) for c in data_part[:-6]]
    # Convert from 5-bit to 8-bit
    acc, bits, out = 0, 0, []
    for v in values:
        acc = (acc << 5) | v
        bits += 5
        while bits >= 8:
            bits -= 8
            out.append((acc >> bits) & 0xFF)
    return bytes(out)

if __name__ == "__main__":
    addr = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read().strip()
    raw = bech32_decode(addr)
    # Pad to 32 bytes (left-pad with zeros)
    padded = b'\x00' * (32 - len(raw)) + raw
    print("0x" + padded.hex())
