# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository scope
- Monorepo with multiple runtimes:
  - Flask backend API (`app.py`, `blockvault/`)
  - React/Vite frontend (`blockvault-frontend/`)
  - FastAPI redaction microservice (`blockvault-redactor/`)
  - Celery worker for async tasks (`blockvault/core/celery_app.py`, `blockvault/core/tasks.py`)
  - Solidity contracts + Hardhat project (`contracts/`)
  - ZK proof tooling for redaction (`zk/redaction/`)

## Existing guidance files
- No existing `AGENTS.md` or `WARP.md` was found.
- No `CLAUDE.md`, `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` was found.
- `pyproject.toml` references `README.md`, but no `README.md` file is currently present in the repo.

## Common development commands

### Full-stack local run
- Start/stop the full local stack (backend + frontend + redactor + worker + infra containers):
  - `./start.sh`
- The script toggles state: running it again stops services.
- Infra managed by Docker Compose includes MongoDB, Redis, MinIO, crypto daemon.

### Backend (Flask + Celery)
- Install backend deps:
  - `python3 -m pip install -r requirements.txt`
- Run backend API directly:
  - `python3 app.py`
- Run Celery worker:
  - `python3 -m celery -A blockvault.core.celery_app worker --loglevel=info --pool=solo`
- Run tests:
  - `pytest tests/ -v`
- Run a single test file:
  - `pytest tests/test_security.py -v`
- Run a single test function:
  - `pytest tests/test_security.py::test_some_case -v`
- Lint (as in CI):
  - `flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics`
  - `flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics`

### Frontend (Vite + React + TypeScript)
- Install deps:
  - `npm --prefix blockvault-frontend ci`
- Dev server:
  - `npm --prefix blockvault-frontend run dev`
- Build:
  - `npm --prefix blockvault-frontend run build`
- Lint:
  - `npm --prefix blockvault-frontend run lint`
- Type-check:
  - `npm --prefix blockvault-frontend run type-check`
- Tests:
  - `npm --prefix blockvault-frontend run test`
- Single frontend test file:
  - `npm --prefix blockvault-frontend run test -- src/utils/__tests__/crypto.test.ts`

### Redactor service (FastAPI)
- Install deps:
  - `python3 -m pip install -r blockvault-redactor/requirements.txt`
- Run service:
  - `python3 -m uvicorn blockvault-redactor.app.main:app --host 0.0.0.0 --port 8000`

### Smart contracts (Hardhat)
- Install deps:
  - `npm --prefix contracts install`
- Compile:
  - `npm --prefix contracts run compile`
- Test all:
  - `npm --prefix contracts run test`
- Test single file:
  - `npx --prefix contracts hardhat test contracts/test/FileRegistry.test.ts`
- Local chain:
  - `npm --prefix contracts run node`

### ZK redaction tooling
- Install deps:
  - `npm --prefix zk/redaction install`
- Backend proof generation depends on artifacts under `zk/redaction/build/` and scripts under `zk/redaction/scripts/`.
- `start.sh` attempts to prepare these artifacts automatically when possible.

## Architecture overview

### 1) Backend app factory and API surface
- Flask app is created in `blockvault/__init__.py` and started by `app.py`.
- `create_app()` wires:
  - config loading (`blockvault/core/config.py`)
  - MongoDB singleton + index setup (`blockvault/core/db.py`)
  - S3/MinIO client (`blockvault/core/s3.py`)
  - optional PostgreSQL/cache/realtime/observability subsystems
  - blueprint registration for auth/files/users/settings/blockchain/compliance/org/workspace/cases/notifications/audit/access/version/performance
- Request lifecycle concerns (CORS, request IDs, security headers, gzip, rate limiting) are centralized in `create_app()`, so cross-cutting behavior is not usually handled in individual route modules.

### 2) Document pipeline (core product flow)
- Primary API surface for document lifecycle is in `blockvault/api/files.py`.
- Storage and integrity path is split across services:
  1. encrypted payloads stored in S3/MinIO (`blockvault/core/s3.py`)
  2. optional IPFS pinning (`blockvault/core/ipfs.py`)
  3. optional on-chain anchoring (`blockvault/core/onchain.py`) using `contracts/FileRegistry.sol`
  4. asynchronous background processing in Celery (`blockvault/core/tasks.py`)
- Redaction and proof generation:
  - analysis/redaction service endpoint integration uses external redactor (`blockvault-redactor/app/main.py`) with inline fallback paths in backend code.
  - ZK proof input/proof generation helpers are in `blockvault/core/zk_redaction.py`.
  - async proof generation + status/progress persistence lives in Celery tasks (`generate_redaction_proof_task`).

### 3) Auth, RBAC, org/workspace model
- Wallet-signature login and token issuance are in `blockvault/api/auth.py`.
- JWT/refresh token primitives and role decorators are in `blockvault/core/security.py`.
- Organization/workspace domain state is handled by:
  - `blockvault/core/organizations.py`
  - `blockvault/core/workspaces.py`
- Login response hydrates org/workspace membership context used by frontend providers.

### 4) Real-time updates
- Backend WebSocket infra is in `blockvault/core/realtime.py` (Flask-SocketIO + JWT handshake + room model).
- Frontend subscription/invalidation logic is in `blockvault-frontend/src/hooks/useRealtimeEvents.ts`, which maps socket events to TanStack Query cache invalidation and UI notifications.

### 5) Frontend composition
- App bootstrap and global provider stack are in `blockvault-frontend/src/App.tsx`.
- Key frontend structure:
  - `src/api/`: HTTP client and service wrappers
  - `src/contexts/`: auth/workspace/file/RBAC state providers
  - `src/pages/`: route-level screens
  - `src/components/`: feature UI modules
  - `src/lib/crypto/` and `src/workers/`: client-side crypto + worker tasks
- Network/auth behavior is centralized in `src/api/client.ts` (auth headers, 401 handling, session-expiry signaling).

## Working conventions for future agents in this repo
- Treat this as a multi-service system: many features involve coordinated backend API + Celery + redactor + frontend behavior.
- When changing API payloads, check both backend route modules and frontend service/context consumers.
- For file/redaction/proof features, verify interactions across:
  - `blockvault/api/files.py`
  - `blockvault/core/tasks.py`
  - `blockvault/core/zk_redaction.py`
  - `blockvault-redactor/app/main.py`
