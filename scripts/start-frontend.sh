#!/usr/bin/env bash
set -euo pipefail

# Install frontend deps and start the backend API + Vite dev server.
# PIDs are written to .logs/*.pid for cleanup.
# Usage:
#   ./scripts/start-frontend.sh

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$PROJECT_ROOT"

mkdir -p .logs

# ── Install dependencies ──────────────────────────────────────────────────────

step "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install --silent 2>&1 | tail -1
  success "Dependencies installed"
else
  success "Dependencies already installed"
fi
cd "$PROJECT_ROOT"

# ── Backend API ───────────────────────────────────────────────────────────────

step "Starting frontend API server (port 3001)..."
cd frontend
node server.js > ../.logs/frontend-backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > ../.logs/frontend-backend.pid
cd "$PROJECT_ROOT"
sleep 2

if kill -0 $BACKEND_PID 2>/dev/null; then
  success "Frontend backend running (PID: $BACKEND_PID)"
else
  error "Backend failed to start. Check .logs/frontend-backend.log"
  tail -5 .logs/frontend-backend.log
  exit 1
fi

# ── Vite dev server ───────────────────────────────────────────────────────────

step "Starting frontend (Vite dev server on port 5173)..."
cd frontend
npx vite --host > ../.logs/frontend-vite.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > ../.logs/frontend-vite.pid
cd "$PROJECT_ROOT"
sleep 3

if kill -0 $FRONTEND_PID 2>/dev/null; then
  success "Frontend running (PID: $FRONTEND_PID)"
else
  error "Frontend failed to start. Check .logs/frontend-vite.log"
  tail -5 .logs/frontend-vite.log
  exit 1
fi
