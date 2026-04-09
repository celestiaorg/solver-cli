#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
#  OIF Solver MVP — All-in-one demo script
# ═══════════════════════════════════════════════════════════════════════════════
#
#  Orchestrates the full E2E demo by calling individual scripts:
#    1. start-network.sh  — Docker infra (Celestia + Anvil + Hyperlane)
#    2. setup.sh          — Deploy OIF contracts, configure, fund, rebalance
#    3. start-services.sh — Aggregator, solver, oracle operator
#    4. start-frontend.sh — Backend API + Vite dev server
#
#  Each script can also be run independently.
#
#  Usage:
#    ./mvp.sh                  # Full setup + start
#    ./mvp.sh --skip-setup     # Skip network + setup, just start services
#    ./mvp.sh --skip-docker    # Skip Docker image builds
#
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source scripts/common.sh

SKIP_SETUP=false
SKIP_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --skip-setup) SKIP_SETUP=true ;;
    --skip-docker) SKIP_DOCKER=true ;;
  esac
done

# ── Service cleanup ──────────────────────────────────────────────────────────

# Ports used by MVP services
MVP_PORTS=(3000 3001 4000 5001)

kill_services() {
  # 1. Kill tracked PID files (direct children)
  for pidfile in logs/*.pid; do
    if [ -f "$pidfile" ]; then
      pid=$(cat "$pidfile")
      # Kill the process group to catch child processes
      kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi
  done
  rm -f logs/*.pid

  # 2. Kill known service processes by name (catches orphans)
  pkill -9 -f "solver-cli solver start" 2>/dev/null || true
  pkill -9 -f "solver-cli rebalancer" 2>/dev/null || true
  pkill -9 -f oracle-operator 2>/dev/null || true
  pkill -9 -f "oif-aggregator" 2>/dev/null || true
  pkill -9 -f "tsx.*server/index.ts" 2>/dev/null || true
  pkill -9 -f "next dev" 2>/dev/null || true

  # 3. Kill anything still holding our ports
  for port in "${MVP_PORTS[@]}"; do
    pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      kill $pid 2>/dev/null || true
    fi
  done
}

cleanup() {
  echo ""
  step "Shutting down services..."
  kill_services
  make stop 2>/dev/null || true
  success "All services stopped"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Pre-start: kill stale services from previous runs ────────────────────────

kill_services

# ── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${PURPLE}${BOLD}"
echo "  ┌─────────────────────────────────────┐"
echo "  │         OIF Solver MVP Demo          │"
echo "  └─────────────────────────────────────┘"
echo -e "${NC}"

# ── Run phases ───────────────────────────────────────────────────────────────

if [ "$SKIP_SETUP" = false ]; then
  DOCKER_FLAG=""
  [ "$SKIP_DOCKER" = true ] && DOCKER_FLAG="--skip-docker"
  ./scripts/start-network.sh $DOCKER_FLAG
  ./scripts/setup.sh
else
  step "Skipping setup (--skip-setup flag)"

  # Still need the stack running
  if ! curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    step "Starting full stack..."
    make start
    success "Stack running"
  fi
fi

./scripts/start-services.sh
./scripts/start-frontend.sh

# ── Ready ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │               MVP Demo Ready!                       │"
echo "  ├─────────────────────────────────────────────────────┤"
echo "  │                                                     │"
echo "  │   Frontend:     http://localhost:3000               │"
echo "  │   Backend API:  http://localhost:3001/api           │"
echo "  │   Aggregator:   http://localhost:4000               │"
echo "  │   Solver API:   http://localhost:5001               │"
echo "  │   Rebalancer:   running (see logs/rebalancer.log)  │"
echo "  │                                                     │"
echo "  │   Docker Stack:                                     │"
echo "  │     Anvil1:     http://localhost:8545               │"
echo "  │     Anvil2:     http://localhost:8546               │"
echo "  │     Celestia:   http://localhost:26657              │"
echo "  │     Forwarding: http://localhost:8080               │"
echo "  │                                                     │"
echo "  │   Faucet: mint USDC on anvil1 (origin chain)       │"
echo "  │   Bridge: make rebalance (anvil1 -> anvil2)        │"
echo "  │                                                     │"
echo "  │   Press Ctrl+C to stop all services                 │"
echo "  │                                                     │"
echo "  └─────────────────────────────────────────────────────┘"
echo -e "${NC}"

# Wait for user interrupt
wait
