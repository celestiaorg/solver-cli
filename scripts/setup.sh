#!/usr/bin/env bash
set -euo pipefail

# Deploy OIF contracts, configure solver, fund accounts, rebalance.
# Requires the network to be running (./scripts/start-network.sh).
# Usage:
#   ./scripts/setup.sh

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$PROJECT_ROOT"

# ── Deploy + configure + fund ────────────────────────────────────────────────

step "Running full setup (init + deploy OIF contracts + configure + fund)..."
make setup FORCE=1

# Allow small losses on local dev (gas costs exceed spread for tiny orders)
if grep -q 'min_profitability_pct = 0.0' .config/solver.toml 2>/dev/null; then
  sed -i'' -e 's/min_profitability_pct = 0.0/min_profitability_pct = -100.0/' .config/solver.toml
  step "Set solver min_profitability_pct = -5.0 for local testing"
fi

success "Setup complete — OIF contracts deployed, solver funded"
