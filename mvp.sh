#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
#  OIF Solver MVP — All-in-one demo script
# ═══════════════════════════════════════════════════════════════════════════════
#
#  Starts everything needed for a full E2E demo:
#    1. Stops any running services
#    2. Cleans previous state
#    3. Starts local chains (Anvil)
#    4. Deploys contracts & sets up the system
#    5. Starts aggregator, solver, oracle operator
#    6. Starts the frontend (React + backend API)
#
#  Usage:
#    ./mvp.sh          # Full setup + start
#    ./mvp.sh --skip-setup  # Skip setup, just start services
#
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SKIP_SETUP=false
if [[ "${1:-}" == "--skip-setup" ]]; then
  SKIP_SETUP=true
fi

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

  # ── Step 3: Start local chains ─────────────────────────────────────────────

  step "Starting local EVM chains..."
  make start
  success "Anvil chains running (ports 8545, 8546)"

  # ── Step 4: Full setup ─────────────────────────────────────────────────────

  step "Running full setup (init + deploy + configure + fund)..."
  make setup FORCE=1
  success "Setup complete — contracts deployed, solver funded"
else
  step "Skipping setup (--skip-setup flag)"

  # Still need chains running
  if ! curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    step "Starting local EVM chains..."
    make start
    success "Anvil chains running"
  fi
fi

# ── Step 5: Install frontend dependencies ──────────────────────────────────

step "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install --silent 2>&1 | tail -1
  success "Dependencies installed"
else
  success "Dependencies already installed"
fi
cd ..

# ── Step 6: Start aggregator ────────────────────────────────────────────────

step "Starting OIF Aggregator (port 4000)..."
make aggregator > .aggregator.log 2>&1 &
AGG_PID=$!
sleep 3

if kill -0 $AGG_PID 2>/dev/null; then
  success "Aggregator running (PID: $AGG_PID)"
else
  error "Aggregator failed to start. Check .aggregator.log"
  cat .aggregator.log | tail -5
  exit 1
fi

# ── Step 7: Start solver ────────────────────────────────────────────────────

step "Starting OIF Solver (port 3000)..."
make solver > .solver-service.log 2>&1 &
SOLVER_PID=$!
sleep 5

if kill -0 $SOLVER_PID 2>/dev/null; then
  success "Solver running (PID: $SOLVER_PID)"
else
  error "Solver failed to start. Check .solver-service.log"
  cat .solver-service.log | tail -5
  exit 1
fi

# ── Step 8: Start oracle operator ────────────────────────────────────────────

step "Starting Oracle Operator..."
make operator > .operator.log 2>&1 &
OPERATOR_PID=$!
sleep 3

if kill -0 $OPERATOR_PID 2>/dev/null; then
  success "Oracle Operator running (PID: $OPERATOR_PID)"
else
  error "Operator failed to start. Check .operator.log"
  cat .operator.log | tail -5
  exit 1
fi

# ── Step 9: Start frontend backend ──────────────────────────────────────────

step "Starting frontend API server (port 3001)..."
cd frontend
node server.js > ../.frontend-backend.log 2>&1 &
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

# ── Step 10: Start Vite dev server ───────────────────────────────────────────

step "Starting frontend (Vite dev server on port 5173)..."
cd frontend
npx vite --host > ../.frontend-vite.log 2>&1 &
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
echo "  │   Frontend:   http://localhost:5173                 │"
echo "  │   Backend:    http://localhost:3001/api             │"
echo "  │   Aggregator: http://localhost:4000                 │"
echo "  │   Solver:     http://localhost:3000                 │"
echo "  │                                                     │"
echo "  │   Press Ctrl+C to stop all services                 │"
echo "  │                                                     │"
echo "  └─────────────────────────────────────────────────────┘"
echo -e "${NC}"

# Wait for user interrupt
wait
