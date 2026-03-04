#!/bin/bash

# BlockVault Start Script
# This script starts both the backend and frontend servers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       BlockVault - Starting Services      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Infrastructure state
INFRA_STARTED_BY_US=false

# Function to start infrastructure via Docker
start_infrastructure() {
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}⚠ Docker not found. BlockVault requires Docker for MongoDB and Crypto services.${NC}"
        echo -e "${YELLOW}  Install Docker: https://docker.com${NC}"
        return 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Docker daemon not running. BlockVault requires Docker for MongoDB and Crypto services.${NC}"
        echo -e "${YELLOW}  Start Docker Desktop.${NC}"
        return 1
    fi

    echo -e "${YELLOW}Starting infrastructure (MongoDB & Crypto) via Docker Compose...${NC}"
    docker compose up -d mongo crypto > /dev/null

    if [ $? -eq 0 ]; then
        INFRA_STARTED_BY_US=true
        echo -e "${GREEN}✓ Infrastructure services started${NC}"
        # Wait for services to be ready
        echo -e "${YELLOW}Waiting for services to initialize...${NC}"
        sleep 3
        return 0
    else
        echo -e "${RED}Failed to start infrastructure containers.${NC}"
        return 1
    fi
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down application services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    
    if [ "$INFRA_STARTED_BY_US" = true ]; then
        echo -e "${YELLOW}Stopping Docker infrastructure (data preserved)...${NC}"
        docker compose stop mongo crypto > /dev/null 2>&1 || true
    fi
    
    echo -e "${GREEN}Services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start infrastructure first
echo -e "${YELLOW}Setting up Infrastructure...${NC}"
start_infrastructure
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python3 is not installed.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Start Backend
echo -e "${YELLOW}Starting Flask Backend...${NC}"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo -e "${YELLOW}Activating virtual environment (venv)...${NC}"
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo -e "${YELLOW}Activating virtual environment (.venv)...${NC}"
    source .venv/bin/activate
else
    echo -e "${YELLOW}No virtual environment found. Using system Python.${NC}"
fi

# Install backend dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install Python dependencies. Please run: pip3 install -r requirements.txt${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
fi

# Start the backend server
S3_BUCKET=mock-bucket S3_ENDPOINT=http://localhost:9000 PORT=5001 python3 app.py &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID) on http://localhost:5001${NC}"

# Start Frontend
echo -e "${YELLOW}Starting Vite Frontend...${NC}"
cd "$SCRIPT_DIR/blockvault-frontend"

# Install frontend dependencies if needed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install frontend dependencies.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
fi

# Start the frontend dev server using npm run dev
npm run dev -- --host &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID) on http://localhost:3000${NC}"

# Wait for services to initialize
sleep 3

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ BlockVault is running!                         ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}  🌐 Frontend: ${NC}${GREEN}http://localhost:3000${NC}"
echo -e "${BLUE}  🔧 Backend:  ${NC}${GREEN}http://localhost:5001${NC}"
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
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop all services${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""

# Wait for both processes
wait
