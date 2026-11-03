# SchoolPass Progress Log

## Current phase
00 - Repository Foundation (NOT STARTED)

## Verified outcomes
- None yet. This starter contains docs only; no application code or tests have been executed.

## Decisions
- MVP is Parent + Teacher, one-day request, one parent/student, one active class/student.
- Modular monolith, React + NestJS + PostgreSQL + Prisma, supporting integrations phased.
- Human review gates every phase; Codex does not implement unapproved tasks.

## Known risks and blockers
- Dependencies/versions not pinned until Phase 00.
- Environment and Docker availability unverified.
- Direct DB-commit-then-queue-enqueue is not atomic; document for P1.

## How to update
For each phase record date, changed files, commands actually executed, results (PASS/FAIL), key learning, open issues, next task. Never invent passing results.
