#!/usr/bin/env bash
set -euo pipefail

# Start the Docker infrastructure: Celestia + Anvil chains + Hyperlane + forwarding.
# Usage:
#   ./scripts/start-network.sh                # Full clean + build + start
#   ./scripts/start-network.sh --skip-docker  # Skip Docker image builds

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$PROJECT_ROOT"

SKIP_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=true ;;
  esac
done

# ── Stop any running services ────────────────────────────────────────────────

step "Stopping any running services..."
make stop 2>/dev/null || true
success "Services stopped"

# ── Clean previous state ─────────────────────────────────────────────────────

step "Cleaning previous state..."
make clean 2>/dev/null || true
success "Cleaned"

# ── Build Docker images ──────────────────────────────────────────────────────

if [ "$SKIP_DOCKER" = false ]; then
  step "Pulling/building Docker images..."
  docker pull ghcr.io/celestiaorg/celestia-app-standalone:v8.0.0-rc0 2>/dev/null || true
  make docker-build
  success "Docker images ready"
else
  step "Skipping Docker image builds (--skip-docker)"
fi

# ── Start full stack ─────────────────────────────────────────────────────────

step "Starting full stack (Celestia + Anvil chains + Hyperlane)..."
step "  This deploys Hyperlane core + warp routes to all 3 chains..."
make start
success "Full stack running:"
success "  Anvil1  (port 8545) — MockERC20 USDC + HypCollateral"
success "  Anvil2  (port 8546) — HypSynthetic USDC"
success "  Celestia (port 26657) — Synthetic USDC (cosmosnative)"
success "  Hyperlane relayer — relaying between all 3 chains"
