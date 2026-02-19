#!/usr/bin/env bash
set -euo pipefail

# Start aggregator, solver, and oracle operator in the background.
# Requires setup to have been run (./scripts/setup.sh).
# PIDs are written to logs/*.pid for cleanup.
# Usage:
#   ./scripts/start-services.sh

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$PROJECT_ROOT"

mkdir -p logs

# ── Aggregator ────────────────────────────────────────────────────────────────

step "Starting OIF Aggregator (port 4000)..."
make aggregator > logs/aggregator.log 2>&1 &
AGG_PID=$!
echo "$AGG_PID" > logs/aggregator.pid
sleep 3

if kill -0 $AGG_PID 2>/dev/null; then
  success "Aggregator running (PID: $AGG_PID)"
else
  error "Aggregator failed to start. Check logs/aggregator.log"
  tail -5 logs/aggregator.log
  exit 1
fi

# ── Solver ────────────────────────────────────────────────────────────────────

step "Starting OIF Solver (port 3000)..."
make solver > logs/solver.log 2>&1 &
SOLVER_PID=$!
echo "$SOLVER_PID" > logs/solver.pid
sleep 5

if kill -0 $SOLVER_PID 2>/dev/null; then
  success "Solver running (PID: $SOLVER_PID)"
else
  error "Solver failed to start. Check logs/solver.log"
  tail -5 logs/solver.log
  exit 1
fi

# ── Oracle Operator ───────────────────────────────────────────────────────────

step "Starting Oracle Operator..."
make operator > logs/operator.log 2>&1 &
OPERATOR_PID=$!
echo "$OPERATOR_PID" > logs/operator.pid
sleep 3

if kill -0 $OPERATOR_PID 2>/dev/null; then
  success "Oracle Operator running (PID: $OPERATOR_PID)"
else
  error "Operator failed to start. Check logs/operator.log"
  tail -5 logs/operator.log
  exit 1
fi
