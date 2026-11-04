# ADR 0001: Local demo delivery uses Docker infrastructure and local app processes

- Status: Accepted for the learning/demo environment
- Date: 2026-11-04

## Context

SchoolPass has a React/Vite client, NestJS API, a separate BullMQ worker, and
PostgreSQL, MinIO, and Redis dependencies. A full application container setup
would need build/runtime images and orchestration for three Node processes in
addition to the stateful services.

## Decision

Docker Compose runs PostgreSQL, MinIO, and Redis only. Developers run the client,
API, and worker with the pinned local Node/npm toolchain using the commands in
the root README. Compose publishes service ports only on loopback. The bucket
remains private and credentials stay in the ignored root `.env` file.

## Consequences and trade-offs

- Local commands exercise the same HTTP API, PostgreSQL constraints, private
  object storage, and Redis/BullMQ used by the application without adding
  service containers or image build time for each code change.
- The API and worker are separate processes but share source, configuration,
  PostgreSQL, and Redis. Run both to demonstrate queued notification handling.
- This is a reproducible local demo workflow, not a production deployment or a
  claim that a fresh machine has been tested. Docker image availability and
  local resource limits can still affect setup.
- The MinIO image is built from a pinned upstream source commit because the
  previously checked release image was unavailable. Its upstream repository is
  archived; replace it with a maintained distribution before production use.
- `/api/v1/health` is a liveness endpoint: it confirms the API process responds.
  It does not prove PostgreSQL, MinIO, or Redis are ready. Compose healthchecks
  are the readiness signals for PostgreSQL and Redis; MinIO has its own local
  liveness URL documented in the README.

## Verification and triage

The quality gates are client lint/build and server lint, unit, HTTP e2e,
PostgreSQL integration, and build checks. The repeatable `npm run smoke` command
checks a live API's Parent → Teacher → Parent journey and verifies that a second
Parent receives 404 for the request. A failing gate should first be reproduced
with the exact documented command; classify it as setup/environment, regression,
or flaky behavior, then fix or record the specific blocker before reporting.
