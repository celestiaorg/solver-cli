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
success "Setup complete — OIF contracts deployed, solver funded"
