#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# DataLens AI — One-command local startup script
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ██████╗  █████╗ ████████╗ █████╗ ██╗     ███████╗███╗   ██╗███████╗"
echo "  ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██║     ██╔════╝████╗  ██║██╔════╝"
echo "  ██║  ██║███████║   ██║   ███████║██║     █████╗  ██╔██╗ ██║███████╗"
echo "  ██║  ██║██╔══██║   ██║   ██╔══██║██║     ██╔══╝  ██║╚██╗██║╚════██║"
echo "  ██████╔╝██║  ██║   ██║   ██║  ██║███████╗███████╗██║ ╚████║███████║"
echo "  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝"
echo -e "${NC}"
echo -e "${CYAN}  Intelligent LLM Database Agent${NC}"
echo ""

# Check for .env
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠  No .env file found. Copying from .env.example...${NC}"
  cp .env.example .env
  echo -e "${RED}✗  Please edit .env and add your ANTHROPIC_API_KEY, then re-run this script.${NC}"
  exit 1
fi

# Load .env
export $(grep -v '^#' .env | xargs)

if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-your-key-here" ]; then
  echo -e "${RED}✗  ANTHROPIC_API_KEY is not set in .env${NC}"
  echo -e "   Get a key at: https://console.anthropic.com"
  exit 1
fi

echo -e "${GREEN}✓  API key found${NC}"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗  Python 3 is required but not found${NC}"
  exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗  Node.js is required but not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓  Python $(python3 --version | cut -d' ' -f2) found${NC}"
echo -e "${GREEN}✓  Node $(node --version) found${NC}"
echo ""

# Install backend deps
echo -e "${CYAN}► Installing backend dependencies...${NC}"
cd backend
pip install -q -r requirements.txt
echo -e "${GREEN}✓  Backend deps installed${NC}"
cd ..

# Install frontend deps
echo -e "${CYAN}► Installing frontend dependencies...${NC}"
cd frontend
npm install --silent
echo -e "${GREEN}✓  Frontend deps installed${NC}"
cd ..

echo ""
echo -e "${CYAN}► Starting services...${NC}"
echo ""

# Start backend
(cd backend && ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" DB_PATH="../database/ecommerce.db" \
  uvicorn main:app --host 0.0.0.0 --port 8000 --log-level warning) &
BACKEND_PID=$!
echo -e "${GREEN}✓  Backend started (PID $BACKEND_PID) → http://localhost:8000${NC}"

# Wait for backend
sleep 2

# Start frontend
(cd frontend && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!
echo -e "${GREEN}✓  Frontend started (PID $FRONTEND_PID) → http://localhost:3000${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  DataLens AI is running!${NC}"
echo -e "${GREEN}  Open: ${CYAN}http://localhost:3000${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo ""

# Trap ctrl-c
cleanup() {
  echo ""
  echo -e "${YELLOW}► Stopping services...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}✓  Stopped. Goodbye!${NC}"
  exit 0
}
trap cleanup INT TERM

wait
