# Phase 06 - BullMQ and Redis

## Goal
Create in-app decision notifications asynchronously and cache teacher dashboard summary.

## Scope
- Add Redis service to Compose; BullMQ notification queue + separately runnable worker.
- On successful decision enqueue `leave.decided` job; worker inserts Notification with unique(userId,leaveRequestId,type).
- Explicit retry/backoff, no duplicate records on replay.
- GET /notifications for authenticated user; read status optional if time.
- GET /dashboard/summary for teacher with cache-aside TTL (~60s) and invalidation after decision.
- Document non-atomic enqueue-after-DB-commit limitation and future outbox path.

## Acceptance criteria
- Successful teacher decision eventually produces exactly one in-app notification under retry.
- Parent cannot fetch others' notifications.
- Cached summary data matches class scope; after decision cache invalidation works.
- Worker crash/retry behavior tested; limitations accurately reported.

## Learning checkpoint
Explain sync vs async, Redis roles, queue/worker/retry, eventual consistency, cache invalidation, idempotency.
