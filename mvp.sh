#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
#  OIF Solver MVP — All-in-one demo script
# ═══════════════════════════════════════════════════════════════════════════════
#
#  Starts everything needed for a full E2E demo:
#    1. Stops any running services
#    2. Cleans previous state
#    3. Builds Docker images (if needed)
#    4. Starts full stack (Celestia + Anvil chains + Hyperlane + relayers)
#    5. Deploys OIF contracts & sets up the system
#    6. Rebalances solver USDC to anvil2 (so solver has tokens on both chains)
#    7. Starts aggregator, solver, oracle operator
#    8. Starts the frontend (React + backend API)
#
#  Prerequisites:
#    - Docker and docker compose
#    - Foundry (forge, cast)
#    - Node.js + npm
#    - Rust toolchain (cargo)
#
#  Usage:
#    ./mvp.sh                  # Full setup + start
#    ./mvp.sh --skip-setup     # Skip setup, just start services
#    ./mvp.sh --skip-docker    # Skip docker image builds
#
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SKIP_SETUP=false
SKIP_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --skip-setup) SKIP_SETUP=true ;;
    --skip-docker) SKIP_DOCKER=true ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

banner() {
  echo ""
  echo -e "${PURPLE}${BOLD}"
  echo "  ┌─────────────────────────────────────┐"
  echo "  │         OIF Solver MVP Demo          │"
  echo "  └─────────────────────────────────────┘"
  echo -e "${NC}"
}

step() {
  echo ""
  echo -e "  ${CYAN}▸${NC} ${BOLD}$1${NC}"
}

success() {
  echo -e "  ${GREEN}✓${NC} $1"
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

error() {
  echo -e "  ${RED}✗${NC} $1"
}

# Cleanup function
cleanup() {
  echo ""
  step "Shutting down services..."
  kill $AGG_PID 2>/dev/null || true
  kill $SOLVER_PID 2>/dev/null || true
  kill $OPERATOR_PID 2>/dev/null || true
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  make stop 2>/dev/null || true
  success "All services stopped"
  exit 0
}

# Track PIDs
AGG_PID=""
SOLVER_PID=""
OPERATOR_PID=""
BACKEND_PID=""
FRONTEND_PID=""

trap cleanup SIGINT SIGTERM

banner

# ── Step 1: Stop everything ────────────────────────────────────────────────

step "Stopping any running services..."
make stop 2>/dev/null || true
success "Services stopped"

if [ "$SKIP_SETUP" = false ]; then
  # ── Step 2: Clean ──────────────────────────────────────────────────────────

  step "Cleaning previous state..."
  make clean 2>/dev/null || true
  success "Cleaned"

  # ── Step 3: Build Docker images (if needed) ────────────────────────────────

  if [ "$SKIP_DOCKER" = false ]; then
    step "Pulling/building Docker images..."
    docker pull ghcr.io/celestiaorg/celestia-app-standalone:v7.0.0-rc0 2>/dev/null || true
    make docker-build
    success "Docker images ready"
  else
    step "Skipping Docker image builds (--skip-docker flag)"
  fi

  # ── Step 4: Start full stack ───────────────────────────────────────────────
  #   Celestia validator + bridge, Anvil (anvil1 + anvil2), Hyperlane init,
  #   Hyperlane relayer, forwarding backend + relayer

  step "Starting full stack (Celestia + Anvil chains + Hyperlane)..."
  step "  This deploys Hyperlane core + warp routes to all 3 chains..."
  make start
  success "Full stack running:"
  success "  Anvil1  (port 8545) — MockERC20 USDC + HypCollateral"
  success "  Anvil2 (port 8546) — HypSynthetic USDC"
  success "  Celestia (port 26657) — Synthetic USDC (cosmosnative)"
  success "  Hyperlane relayer — relaying between all 3 chains"

  # ── Step 5: Full setup ─────────────────────────────────────────────────────

  step "Running full setup (init + deploy OIF contracts + configure + fund)..."
  make setup FORCE=1
  success "Setup complete — OIF contracts deployed, solver funded"

  # ── Step 5.5: Rebalance solver USDC to anvil2 ─────────────────────────────

  step "Rebalancing solver USDC to anvil2 (so solver has tokens on both chains)..."
  make rebalance || warn "Rebalance failed — solver may not have USDC on anvil2"
else
  step "Skipping setup (--skip-setup flag)"

  # Still need the stack running
  if ! curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    step "Starting full stack..."
    make start
    success "Stack running"
  fi
fi

# ── Step 6: Install frontend dependencies ──────────────────────────────────

step "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install --silent 2>&1 | tail -1
  success "Dependencies installed"
else
  success "Dependencies already installed"
fi
cd ..

# Create logs directory for service output
mkdir -p logs

# ── Step 7: Start aggregator ────────────────────────────────────────────────

step "Starting OIF Aggregator (port 4000)..."
make aggregator > logs/aggregator.log 2>&1 &
AGG_PID=$!
sleep 3

if kill -0 $AGG_PID 2>/dev/null; then
  success "Aggregator running (PID: $AGG_PID)"
else
  error "Aggregator failed to start. Check logs/aggregator.log"
  cat logs/aggregator.log | tail -5
  exit 1
fi

# ── Step 8: Start solver ────────────────────────────────────────────────────

step "Starting OIF Solver (port 3000)..."
make solver > logs/solver.log 2>&1 &
SOLVER_PID=$!
sleep 5

if kill -0 $SOLVER_PID 2>/dev/null; then
  success "Solver running (PID: $SOLVER_PID)"
else
  error "Solver failed to start. Check logs/solver.log"
  cat logs/solver.log | tail -5
  exit 1
fi

# ── Step 9: Start oracle operator ────────────────────────────────────────────

step "Starting Oracle Operator..."
make operator > logs/operator.log 2>&1 &
OPERATOR_PID=$!
sleep 3

if kill -0 $OPERATOR_PID 2>/dev/null; then
  success "Oracle Operator running (PID: $OPERATOR_PID)"
else
  error "Operator failed to start. Check logs/operator.log"
  cat logs/operator.log | tail -5
  exit 1
fi

# ── Step 10: Start frontend backend ──────────────────────────────────────────

step "Starting frontend API server (port 3001)..."
cd frontend
node server.js > ../logs/frontend-backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 2

if kill -0 $BACKEND_PID 2>/dev/null; then
  success "Frontend backend running (PID: $BACKEND_PID)"
else
  error "Backend failed to start. Check .frontend-backend.log"
  cat .frontend-backend.log | tail -5
  exit 1
fi

# ── Step 11: Start Vite dev server ───────────────────────────────────────────

step "Starting frontend (Vite dev server on port 5173)..."
cd frontend
npx vite --host > ../logs/frontend-vite.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 3

if kill -0 $FRONTEND_PID 2>/dev/null; then
  success "Frontend running (PID: $FRONTEND_PID)"
else
  error "Frontend failed to start. Check .frontend-vite.log"
  cat .frontend-vite.log | tail -5
  exit 1
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │               MVP Demo Ready!                       │"
echo "  ├─────────────────────────────────────────────────────┤"
echo "  │                                                     │"
echo "  │   Frontend:     http://localhost:5173               │"
echo "  │   Backend API:  http://localhost:3001/api           │"
echo "  │   Aggregator:   http://localhost:4000               │"
echo "  │   Solver:       http://localhost:3000               │"
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
