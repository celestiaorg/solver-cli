#!/usr/bin/env bash
set -euo pipefail

# Generate frontend/src/lib/constants/tokens.ts from .config/state.json
# Called by make configure / make mvp to keep frontend in sync with deployed contracts.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$PROJECT_ROOT/.config/state.json"
OUT="$PROJECT_ROOT/frontend/src/lib/constants/tokens.ts"

if [ ! -f "$STATE" ]; then
  echo "  No state.json found, skipping frontend config generation"
  exit 0
fi

STATE_PATH="$STATE" OUT_PATH="$OUT" python3 << 'PYEOF'
import json, sys

import os
state_path = os.environ['STATE_PATH']
out_path = os.environ['OUT_PATH']

state = json.load(open(state_path))
chains = state.get('chains', {})
if not chains:
    sys.exit(0)

sorted_chains = sorted(chains.items(), key=lambda x: int(x[0]))
NL = '\n'

lines = []
lines.append("// Auto-generated from .config/state.json — do not edit manually")
lines.append("// Regenerate with: make configure")
lines.append("")

# CHAIN_CONFIG
lines.append("export const CHAIN_CONFIG = {")
for i, (cid, c) in enumerate(sorted_chains):
    name = c['name']
    comma = ',' if i < len(sorted_chains) - 1 else ','
    lines.append(f"  {name}: {{")
    lines.append(f"    chainId: {cid},")
    lines.append(f"    domainId: {cid},")
    lines.append(f"    name: '{name.title()}',")
    lines.append(f"    serverName: '{name}',")
    lines.append(f"    rpc: '{c['rpc']}',")
    lines.append(f"    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',")
    lines.append(f"  }}{comma}")
lines.append("} as const;")
lines.append("")

# CONTRACTS
lines.append("export const CONTRACTS = {")
for i, (cid, c) in enumerate(sorted_chains):
    name = c['name']
    contracts = c.get('contracts', {})
    tokens = c.get('tokens', {})
    lines.append(f"  {name}: {{")
    for sym, tok in tokens.items():
        lines.append(f"    {sym.lower()}: '{tok['address']}',")
    lines.append(f"    inputSettler: '{contracts.get('input_settler_escrow', '')}',")
    lines.append(f"    outputSettler: '{contracts.get('output_settler_simple', '')}',")
    lines.append(f"    oracle: '{contracts.get('oracle', '')}',")
    lines.append(f"  }},")
lines.append("  celestia: {")
lines.append("    domainId: 69420,")
lines.append("    restUrl: 'http://127.0.0.1:1317',")
lines.append("  },")
lines.append("  forwardingService: 'http://127.0.0.1:8080',")
lines.append("} as const;")
lines.append("")

# Types
lines.append("""export interface TokenDef {
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  addresses: Partial<
    Record<
      number,
      {
        token: string | 'native';
        warpRoute?: string;
        type: 'collateral' | 'synthetic' | 'native';
      }
    >
  >;
}""")
lines.append("")

# Collect all tokens across chains
all_tokens = {}
for cid, c in sorted_chains:
    for sym, tok in c.get('tokens', {}).items():
        if sym not in all_tokens:
            all_tokens[sym] = {'decimals': tok.get('decimals', 18), 'chains': []}
        is_first = (cid == sorted_chains[0][0])
        all_tokens[sym]['chains'].append({
            'chain_name': c['name'],
            'address': tok['address'],
            'type': 'collateral' if is_first else 'synthetic',
        })

# TOKENS
lines.append("export const TOKENS: Record<string, TokenDef> = {")
for sym, info in all_tokens.items():
    lines.append(f"  {sym}: {{")
    lines.append(f"    symbol: '{sym}',")
    lines.append(f"    name: '{sym}',")
    lines.append(f"    decimals: {info['decimals']},")
    lines.append(f"    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',")
    lines.append(f"    addresses: {{")
    for ci in info['chains']:
        cn = ci['chain_name']
        lines.append(f"      [CHAIN_CONFIG.{cn}.chainId]: {{")
        lines.append(f"        token: '{ci['address']}',")
        lines.append(f"        type: '{ci['type']}',")
        lines.append(f"      }},")
    lines.append(f"    }},")
    lines.append(f"  }},")
lines.append("};")
lines.append("")

# getTokensForRoute
lines.append("""export function getTokensForRoute(
  fromChainId: number,
  toChainId: number
): string[] {
  return Object.keys(TOKENS).filter(
    s => TOKENS[s].addresses[fromChainId] && TOKENS[s].addresses[toChainId]
  );
}""")
lines.append("")

with open(out_path, 'w') as f:
    f.write(NL.join(lines))

PYEOF

echo "  Frontend tokens.ts generated from state.json"
