#!/usr/bin/env python3
"""
Convert EIP-155 text addresses to ERC-7930 hex-encoded InteropAddress format.

Usage:
    python3 convert_address.py "eip155:chainId:0xaddress"

Example:
    python3 convert_address.py "eip155:1234:0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
    # Output: 0x000100000204d214cf7ed3acca5a467e9e704c703e8d87f634fb0fc9

ERC-7930 Format:
    Version(2 bytes) | ChainType(2 bytes) | ChainRefLen(1 byte) | ChainRef(variable) | AddrLen(1 byte) | Address(20 bytes)
"""

import sys


def text_to_hex(text: str) -> str:
    """Convert eip155:chainId:0xaddress to ERC-7930 hex format"""
    parts = text.split(':')
    if len(parts) != 3 or parts[0] != 'eip155':
        raise ValueError("Expected format: eip155:chainId:0xaddress")

    chain_id = int(parts[1])
    addr_str = parts[2]

    if not addr_str.startswith('0x'):
        raise ValueError("Address must start with 0x")

    address = bytes.fromhex(addr_str[2:])
    if len(address) != 20:
        raise ValueError("Address must be 20 bytes")

    # Encode chain ID as minimal big-endian
    chain_ref = chain_id.to_bytes((chain_id.bit_length() + 7) // 8, 'big')

    # Build ERC-7930 binary format
    # Version(2) | ChainType(2) | ChainRefLen(1) | ChainRef | AddrLen(1) | Address
    result = bytearray()
    result.extend((1).to_bytes(2, 'big'))  # version = 1
    result.extend(bytes([0x00, 0x00]))      # chain_type = EIP-155
    result.append(len(chain_ref))           # chain_ref length (1 byte)
    result.extend(chain_ref)                # chain reference
    result.append(len(address))             # address length (1 byte)
    result.extend(address)                  # address

    return '0x' + result.hex()


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        print("\nError: Missing argument", file=sys.stderr)
        sys.exit(1)

    try:
        hex_addr = text_to_hex(sys.argv[1])
        print(hex_addr)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
