# SchoolPass Harness Starter

This is a **planning and verification harness**, not a prebuilt application. The developer and Codex build SchoolPass together one small, testable phase at a time.

## First use
1. Copy the contents of this directory into a new `schoolpass` git repository.
2. Read `docs/PROJECT_BRIEF.md` and `harness/tasks/00-foundation.md`.
3. Start Codex with workspace-limited permissions, e.g. `codex --sandbox workspace-write --ask-for-approval on-request`.
4. Ask Codex to perform *read-only discovery and propose a plan* for phase 00.
5. Approve the plan, request phase 00 implementation, inspect actual command outputs, then update `harness/progress.md`.
6. Repeat, one task at a time. Never treat a self-reported PASS as proof without command output.

## Stack
React + TypeScript + Vite; NestJS + TypeScript; PostgreSQL; Prisma ORM (version locked to current official guide); Redis; BullMQ; MinIO; Docker Compose. Git and a small design system are required.

## Scope
Parent submits one-day sick/permission requests for their own children. Teacher reviews only students in their assigned classes. No public sign-up. Accounts and children are seeded for demo. Optional single attachment per request, in-app notification after decision, cached dashboard summary.

## Phases
00 foundation; 01 DB; 02 authentication; 03 leave workflow backend; 04 frontend workflow; 05 object storage; 06 queues and cache; 07 integration, QA, and demo. If short on time, complete phases 00–04 with tests before the optional integrations.
