#!/usr/bin/env bash
set -euo pipefail

# Install frontend deps and start the backend API + Next.js dev server.
# PIDs are written to logs/*.pid for cleanup.
# Usage:
#   ./scripts/start-frontend.sh

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$PROJECT_ROOT"

mkdir -p logs

# ── Kill stale processes on our ports ────────────────────────────────────────

for port in 3000 3001; do
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null || true
    sleep 0.5
  fi
done

# ── Install dependencies ──────────────────────────────────────────────────────

step "Installing frontend dependencies..."
cd frontend
pnpm install --silent 2>&1 | tail -1
success "Dependencies installed"
cd "$PROJECT_ROOT"

# ── Backend API ───────────────────────────────────────────────────────────────

step "Starting frontend API server (port 3001)..."
cd frontend
pnpm exec tsx server/index.ts > ../logs/frontend-backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > ../logs/frontend-backend.pid
cd "$PROJECT_ROOT"
sleep 2

if kill -0 $BACKEND_PID 2>/dev/null; then
  success "Frontend backend running (PID: $BACKEND_PID)"
else
  error "Backend failed to start. Check logs/frontend-backend.log"
  tail -5 logs/frontend-backend.log
  exit 1
fi

# ── Next.js dev server ───────────────────────────────────────────────────────

step "Starting frontend (Next.js dev server on port 3000)..."
cd frontend
pnpm exec next dev --port 3000 > ../logs/frontend-next.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > ../logs/frontend-next.pid
cd "$PROJECT_ROOT"
sleep 3

if kill -0 $FRONTEND_PID 2>/dev/null; then
  success "Frontend running (PID: $FRONTEND_PID)"
else
  error "Frontend failed to start. Check logs/frontend-next.log"
  tail -5 logs/frontend-next.log
  exit 1
fi
