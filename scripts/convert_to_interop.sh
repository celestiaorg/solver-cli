#!/bin/bash
# Convert eip155:chainId:0xaddress to ERC-7930 hex format

if [ $# -ne 1 ]; then
    echo "Usage: $0 'eip155:chainId:0xaddress'"
    exit 1
fi

TEXT_ADDR="$1"

# Use a simple Rust script to do the conversion
cat > /tmp/convert_addr.rs << 'EOF'
use std::env;

fn encode_chain_id_min_be(chain_id: u64) -> Vec<u8> {
    let be = chain_id.to_be_bytes();
    let first_nz = be.iter().position(|&b| b != 0).unwrap_or(be.len() - 1);
    be[first_nz..].to_vec()
}

fn text_to_hex(text: &str) -> Result<String, String> {
    let parts: Vec<&str> = text.split(':').collect();
    if parts.len() != 3 || parts[0] != "eip155" {
        return Err("Expected format: eip155:chainId:0xaddress".to_string());
    }

    let chain_id: u64 = parts[1].parse().map_err(|_| "Invalid chain ID")?;
    let addr_str = parts[2];

    if !addr_str.starts_with("0x") {
        return Err("Address must start with 0x".to_string());
    }

    let address = hex::decode(&addr_str[2..]).map_err(|_| "Invalid hex address")?;

    if address.len() != 20 {
        return Err("Address must be 20 bytes".to_string());
    }

    let chain_ref = encode_chain_id_min_be(chain_id);

    // Build ERC-7930 binary format:
    // Version (2 bytes) | ChainType (2 bytes) | ChainRefLen (2 bytes) | ChainRef | AddrLen (2 bytes) | Address
    let mut result = Vec::new();
    result.extend_from_slice(&1u16.to_be_bytes()); // version = 1
    result.extend_from_slice(&[0x00, 0x00]); // chain_type = EIP-155
    result.extend_from_slice(&(chain_ref.len() as u16).to_be_bytes());
    result.extend_from_slice(&chain_ref);
    result.extend_from_slice(&(address.len() as u16).to_be_bytes());
    result.extend_from_slice(&address);

    Ok(format!("0x{}", hex::encode(result)))
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        eprintln!("Usage: {} 'eip155:chainId:0xaddress'", args[0]);
        std::process::exit(1);
    }

    match text_to_hex(&args[1]) {
        Ok(hex) => println!("{}", hex),
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}
EOF

# Compile and run
cd /tmp && rustc convert_addr.rs 2>/dev/null && ./convert_addr "$TEXT_ADDR"
rm -f /tmp/convert_addr.rs /tmp/convert_addr
