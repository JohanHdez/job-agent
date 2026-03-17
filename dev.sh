#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Job Agent — Dev Launcher
# Starts: Redis · MongoDB check · NestJS API (3001) · Vite Web (5173)
# Usage:  bash dev.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "  ${BLUE}→${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║        Job Agent  —  Dev Server          ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. .env ───────────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  err ".env not found — copy .env.example and fill in your credentials"
  exit 1
fi
ok ".env found"

# ── 2. Redis ──────────────────────────────────────────────────────────────────
REDIS_EXE="C:/Program Files/Redis/redis-server.exe"
REDIS_CONF="C:/Program Files/Redis/redis.windows.conf"

if tasklist 2>/dev/null | grep -qi "redis-server"; then
  ok "Redis already running"
else
  if [ -f "$REDIS_EXE" ]; then
    info "Starting Redis..."
    # Start Redis detached — Windows needs cmd /c start to detach properly
    cmd //c start /min "" "$REDIS_EXE" "$REDIS_CONF" &
    sleep 1
    ok "Redis started (port 6379)"
  else
    err "Redis not found at '$REDIS_EXE'"
    err "Install Redis for Windows: winget install Redis.Redis"
    exit 1
  fi
fi

# ── 3. MongoDB ────────────────────────────────────────────────────────────────
if tasklist 2>/dev/null | grep -qi "mongod"; then
  ok "MongoDB already running"
else
  # Try to start the MongoDB Windows service (common install path)
  if net start MongoDB 2>/dev/null | grep -qi "started\|running"; then
    ok "MongoDB service started"
  else
    warn "MongoDB not detected — make sure mongod is running"
    warn "Start it with:  net start MongoDB  or  mongod --dbpath C:/data/db"
  fi
fi

# ── 4. Dependencies ───────────────────────────────────────────────────────────
if [ ! -d "$ROOT/node_modules" ]; then
  info "Installing npm dependencies..."
  cd "$ROOT" && npm install --silent
  ok "Dependencies installed"
else
  ok "node_modules present"
fi

# ── 5. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Services starting:${NC}"
echo -e "  ${CYAN}API${NC}   http://localhost:3001"
echo -e "  ${CYAN}Web${NC}   http://localhost:5173"
echo -e "  ${CYAN}Health${NC} http://localhost:3001/health"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services"
echo ""

# ── 6. Start API + Web ────────────────────────────────────────────────────────
cd "$ROOT"
exec npx concurrently \
  --names "API,WEB" \
  --prefix-colors "cyan,magenta" \
  --prefix "[{name}]" \
  --kill-others-on-fail \
  "npm run dev -w @job-agent/api" \
  "npm run dev -w @job-agent/web"
