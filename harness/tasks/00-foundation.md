# Phase 00 - Repository Foundation

## Goal
Create a reproducible, minimally scaffolded local developer environment without implementing product features.

## Preflight (read-only)
- Inspect current repository and git status.
- Check Node/npm and Docker/Compose availability; avoid guessing.
- Read AGENTS.md, PROJECT_BRIEF, ARCHITECTURE, QUALITY.
- Propose exact files/commands before writing. Require user approval.

## Approved implementation scope (after human confirmation)
- Scaffold React + TypeScript + Vite inside `client/` and NestJS + TypeScript inside `server/` using supported tool versions and npm.
- Pick and document compatible Node version; ESM module choice consistent with current NestJS and Prisma official guides.
- Create sensible .gitignore and .env.example without credentials.
- Configure Docker Compose with *only PostgreSQL* initially, persistent named volume and health check.
- Create a health endpoint e.g. GET /api/v1/health with response `{ status: 'ok' }`.
- Create root README instructions to run DB, API, frontend and verify health.
- Do not add Prisma database models, JWT, Redis, MinIO, BullMQ or business features yet.

## Acceptance criteria
- `npm install` succeeds for client and server.
- Both apps build and lint with available scripts.
- PostgreSQL container starts and is healthy; API health route returns 200.
- README has exact commands that were actually tested; no real secrets committed.
- Report exact versions and any failures.

## Learning checkpoint
Explain what Vite, NestJS module/controller, container, image, volume, port mapping and health check each do.
