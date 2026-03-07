#!/bin/bash

# BlockVault Service Toggle Script
# Usage: ./start.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.blockvault_pids"
LOG_DIR="$SCRIPT_DIR/.blockvault_logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACKEND_PID=""
FRONTEND_PID=""
REDACTOR_PID=""
INFRA_STARTED="false"
PYTHON_BIN=""
PIP_CMD=""
PIP_FLAGS=""

is_running() {
  local pid="$1"
  if [ -z "$pid" ]; then
    return 1
  fi
  kill -0 "$pid" >/dev/null 2>&1
}

read_pidfile() {
  if [ -f "$PID_FILE" ]; then
    BACKEND_PID=$(grep -E '^BACKEND_PID=' "$PID_FILE" | head -n1 | cut -d= -f2 || true)
    FRONTEND_PID=$(grep -E '^FRONTEND_PID=' "$PID_FILE" | head -n1 | cut -d= -f2 || true)
    REDACTOR_PID=$(grep -E '^REDACTOR_PID=' "$PID_FILE" | head -n1 | cut -d= -f2 || true)
    INFRA_STARTED=$(grep -E '^INFRA_STARTED=' "$PID_FILE" | head -n1 | cut -d= -f2 || true)
  fi
}

write_pidfile() {
  cat > "$PID_FILE" <<EOF
BACKEND_PID=$BACKEND_PID
FRONTEND_PID=$FRONTEND_PID
REDACTOR_PID=$REDACTOR_PID
INFRA_STARTED=$INFRA_STARTED
EOF
}

start_infrastructure() {
  # Check if Docker is available
  if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker not found. BlockVault requires Docker for MongoDB, Crypto, and MinIO.${NC}"
    echo -e "${YELLOW}  Install Docker: https://docker.com${NC}"
    return 1
  fi

  # Check if Docker daemon is running
  if ! docker info &> /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Docker daemon not running. BlockVault requires Docker for MongoDB, Crypto, and MinIO.${NC}"
    echo -e "${YELLOW}  Start Docker Desktop.${NC}"
    return 1
  fi

  echo -e "${YELLOW}Starting infrastructure (MongoDB, Redis, Crypto, MinIO) via Docker Compose...${NC}"
  docker compose up -d mongo redis crypto minio minio-init > /dev/null

  if [ $? -eq 0 ]; then
    INFRA_STARTED="true"
    echo -e "${GREEN}✓ Infrastructure services started${NC}"
    echo -e "${YELLOW}Waiting for services to initialize...${NC}"
    sleep 3
    return 0
  else
    echo -e "${RED}Failed to start infrastructure containers.${NC}"
    return 1
  fi
}

stop_infrastructure() {
  if ! command -v docker &> /dev/null; then
    return 0
  fi
  if ! docker info &> /dev/null 2>&1; then
    return 0
  fi
  echo -e "${YELLOW}Stopping Docker infrastructure (data preserved)...${NC}"
  docker compose stop mongo crypto minio redis > /dev/null 2>&1 || true
}

kill_pid_force() {
  local pid="$1"
  if [ -z "$pid" ]; then
    return 0
  fi
  kill -KILL "$pid" >/dev/null 2>&1 || true
}

kill_by_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      kill -TERM $pids >/dev/null 2>&1 || true
      sleep 1
      pids=$(lsof -ti ":$port" 2>/dev/null || true)
      if [ -n "$pids" ]; then
        kill -KILL $pids >/dev/null 2>&1 || true
      fi
    fi
  fi
}

kill_by_pattern() {
  local pattern="$1"
  if command -v pgrep >/dev/null 2>&1; then
    local pids
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      kill -TERM $pids >/dev/null 2>&1 || true
      sleep 1
      pids=$(pgrep -f "$pattern" 2>/dev/null || true)
      if [ -n "$pids" ]; then
        kill -KILL $pids >/dev/null 2>&1 || true
      fi
    fi
  fi
}

port_in_use() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 1
  fi
  lsof -ti ":$port" >/dev/null 2>&1
}

wait_for_port() {
  local port="$1"
  local timeout_secs="${2:-20}"
  local i=0
  while [ "$i" -lt "$timeout_secs" ]; do
    if port_in_use "$port"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

select_python_runtime() {
  if [ -d "$SCRIPT_DIR/venv" ]; then
    PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
    PIP_CMD="$SCRIPT_DIR/venv/bin/python -m pip"
    PIP_FLAGS=""
    return 0
  fi

  if [ -d "$SCRIPT_DIR/.venv" ]; then
    PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
    PIP_CMD="$SCRIPT_DIR/.venv/bin/python -m pip"
    PIP_FLAGS=""
    return 0
  fi

  if [ -x "/usr/bin/python3" ]; then
    PYTHON_BIN="/usr/bin/python3"
    PIP_CMD="/usr/bin/python3 -m pip"
    PIP_FLAGS="--user"
    return 0
  fi

  if [ -x "/Library/Developer/CommandLineTools/usr/bin/python3" ]; then
    PYTHON_BIN="/Library/Developer/CommandLineTools/usr/bin/python3"
    PIP_CMD="/Library/Developer/CommandLineTools/usr/bin/python3 -m pip"
    PIP_FLAGS="--user"
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
    PIP_CMD="$PYTHON_BIN -m pip"
    PIP_FLAGS=""
    return 0
  fi

  return 1
}

any_services_running() {
  read_pidfile

  if is_running "$BACKEND_PID" || is_running "$FRONTEND_PID" || is_running "$REDACTOR_PID"; then
    return 0
  fi

  if port_in_use 3000 || port_in_use 5001 || port_in_use 8000; then
    return 0
  fi

  return 1
}

stop_services() {
  read_pidfile

  if [ -n "$BACKEND_PID" ] && is_running "$BACKEND_PID"; then
    echo -e "${YELLOW}Stopping backend (PID: $BACKEND_PID)...${NC}"
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$FRONTEND_PID" ] && is_running "$FRONTEND_PID"; then
    echo -e "${YELLOW}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$REDACTOR_PID" ] && is_running "$REDACTOR_PID"; then
    echo -e "${YELLOW}Stopping redactor (PID: $REDACTOR_PID)...${NC}"
    kill "$REDACTOR_PID" >/dev/null 2>&1 || true
  fi

  # Give processes a chance to exit, then force-kill any stragglers.
  sleep 1
  if [ -n "$BACKEND_PID" ] && is_running "$BACKEND_PID"; then
    kill_pid_force "$BACKEND_PID"
  fi
  if [ -n "$FRONTEND_PID" ] && is_running "$FRONTEND_PID"; then
    kill_pid_force "$FRONTEND_PID"
  fi
  if [ -n "$REDACTOR_PID" ] && is_running "$REDACTOR_PID"; then
    kill_pid_force "$REDACTOR_PID"
  fi

  # Fallback: kill by port if still running
  kill_by_port 5001
  kill_by_port 3000
  kill_by_port 8000
  # Extra fallback: kill known command patterns in case wrapper PIDs changed
  kill_by_pattern "python3 app.py"
  kill_by_pattern "python app.py"
  kill_by_pattern "uvicorn app.main:app"
  kill_by_pattern "blockvault-redactor"
  kill_by_pattern "vite --host"
  kill_by_pattern "node .*vite"

  # Always try to stop infra; no-op if Docker/daemon is unavailable.
  stop_infrastructure

  rm -f "$PID_FILE"
  echo -e "${GREEN}Services stopped.${NC}"
}

start_services() {
  read_pidfile
  if is_running "$BACKEND_PID" || is_running "$FRONTEND_PID"; then
    echo -e "${YELLOW}Services already running.${NC}"
    echo -e "${YELLOW}Run './start.sh' again to stop them.${NC}"
    exit 0
  fi
  if port_in_use 5001 || port_in_use 3000 || port_in_use 8000; then
    echo -e "${YELLOW}Ports 5001 and/or 3000 and/or 8000 are already in use.${NC}"
    echo -e "${YELLOW}Run './start.sh' once to stop existing services, or free those ports manually.${NC}"
    exit 1
  fi

  echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║       BlockVault - Starting Services      ║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${YELLOW}Setting up Infrastructure...${NC}"
  if ! start_infrastructure; then
    echo -e "${RED}Infrastructure startup failed. Backend/frontend will not be started.${NC}"
    exit 1
  fi
  echo ""

  # Select a Python runtime compatible with the installed backend deps.
  if ! select_python_runtime; then
    echo -e "${RED}Error: No supported Python runtime found.${NC}"
    exit 1
  fi

  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    exit 1
  fi

  cd "$SCRIPT_DIR"
  mkdir -p "$LOG_DIR"

  # Start Redactor (FastAPI)
  echo -e "${YELLOW}Starting Redactor service...${NC}"
  cd "$SCRIPT_DIR/blockvault-redactor"
  if [ -x ".venv/bin/uvicorn" ]; then
    nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$LOG_DIR/redactor.log" 2>&1 &
  else
    nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$LOG_DIR/redactor.log" 2>&1 &
  fi
  REDACTOR_PID=$!
  if ! wait_for_port 8000 30; then
    echo -e "${RED}Redactor failed to start on port 8000. Recent logs:${NC}"
    tail -n 40 "$LOG_DIR/redactor.log" || true
    exit 1
  fi
  echo -e "${GREEN}✓ Redactor started (PID: $REDACTOR_PID) on http://localhost:8000${NC}"

  # Start Backend
  cd "$SCRIPT_DIR"
  echo -e "${YELLOW}Starting Flask Backend...${NC}"
  echo -e "${YELLOW}Using Python runtime: $PYTHON_BIN${NC}"

  if [ -f "requirements.txt" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    eval "$PIP_CMD install $PIP_FLAGS -r requirements.txt"
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
  fi

  nohup env \
    S3_BUCKET="${S3_BUCKET:-mock-bucket}" \
    S3_REGION="${S3_REGION:-us-east-1}" \
    S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}" \
    S3_ACCESS_KEY="${S3_ACCESS_KEY:-mock-access-key}" \
    S3_SECRET_KEY="${S3_SECRET_KEY:-mock-secret-key}" \
    REDACTOR_SERVICE_URL="${REDACTOR_SERVICE_URL:-http://localhost:8000}" \
    PORT=5001 \
    "$PYTHON_BIN" app.py >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
  if ! wait_for_port 5001 25; then
    echo -e "${RED}Backend failed to start on port 5001. Recent logs:${NC}"
    tail -n 40 "$BACKEND_LOG" || true
    exit 1
  fi
  echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID) on http://localhost:5001${NC}"

  # Start Frontend
  echo -e "${YELLOW}Starting Vite Frontend...${NC}"
  cd "$SCRIPT_DIR/blockvault-frontend"

  if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
  fi

  nohup npm run dev -- --host >"$FRONTEND_LOG" 2>&1 &
  FRONTEND_PID=$!
  if ! wait_for_port 3000 25; then
    echo -e "${RED}Frontend failed to start on port 3000. Recent logs:${NC}"
    tail -n 40 "$FRONTEND_LOG" || true
    exit 1
  fi
  echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID) on http://localhost:3000${NC}"

  write_pidfile

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✓ BlockVault is running!                         ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BLUE}  🌐 Frontend: ${NC}${GREEN}http://localhost:3000${NC}"
  echo -e "${BLUE}  🔧 Backend:  ${NC}${GREEN}http://localhost:5001${NC}"
  echo -e "${BLUE}  ✂️  Redactor: ${NC}${GREEN}http://localhost:8000${NC}"
  if docker compose ps --services --filter "status=running" 2>/dev/null | grep -q "mongo"; then
    echo -e "${BLUE}  🗄️  MongoDB:  ${NC}${GREEN}localhost:27017 (Docker)${NC}"
  else
    echo -e "${BLUE}  🗄️  MongoDB:  ${NC}${RED}Not running${NC}"
  fi
  if docker compose ps --services --filter "status=running" 2>/dev/null | grep -q "^crypto$"; then
    echo -e "${BLUE}  🔐 Crypto:   ${NC}${GREEN}localhost:9876 (Docker)${NC}"
  else
    echo -e "${BLUE}  🔐 Crypto:   ${NC}${RED}Not running${NC}"
  fi
  if docker compose ps --services --filter "status=running" 2>/dev/null | grep -q "^minio$"; then
    echo -e "${BLUE}  🪣 MinIO:    ${NC}${GREEN}localhost:9000 (Docker)${NC}"
  else
    echo -e "${BLUE}  🪣 MinIO:    ${NC}${RED}Not running${NC}"
  fi
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Run './start.sh' again to stop all services${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo ""
}

if [ -n "${1:-}" ]; then
  echo -e "${YELLOW}Arguments are no longer required. Using smart toggle mode.${NC}"
fi

if any_services_running; then
  echo -e "${YELLOW}Detected running BlockVault services. Stopping all...${NC}"
  stop_services
else
  start_services
fi
