# SchoolPass Agent Guidelines

## Mission
Build a small, secure student-leave management application for Parent and Teacher roles. The purpose is to demonstrate React, NestJS, PostgreSQL, Prisma, MinIO, Redis, BullMQ, Docker, Git, REST APIs, design systems, and SDLC.

## Source of truth
Read these files BEFORE proposing or implementing a change:
1. `docs/PROJECT_BRIEF.md` for business objectives and non-goals.
2. `docs/REQUIREMENTS.md` for business rules and acceptance criteria.
3. `docs/ARCHITECTURE.md` for stack and architectural boundaries.
4. `docs/DATABASE.md` and `docs/API.md` for data and API contracts.
5. The ONE active file in `harness/tasks/` for the current phase.
6. `harness/progress.md` for current status, decisions, blockers.

If documents disagree, stop and request clarification before changing code. Don't silently invent requirements.

## Working agreement
- Start each task with a short plan in Bahasa Indonesia: files to change, risks, tests, and questions if blocked.
- Implement ONE phase or small vertical slice per request. Do not generate the entire app in one pass.
- Preserve existing working code; make the smallest coherent change; do not add features outside the active phase.
- Explain important concepts and trade-offs for learning, particularly NestJS DI, database constraints, authorization, and asynchronous processing.
- Follow modular monolith architecture. Keep HTTP controllers thin; business rules in services; database access via Prisma.
- Validate input on the server; authenticate and check record-level authorization for every protected resource.
- No secrets, real student data, or credentials in tracked files. Provide `.env.example` only.
- No destructive commands, force pushes, blanket file deletion, production deploys, or installing unrequested services without explicit human approval.
- Do not create commits or merge branches unless explicitly asked.
- Prefer official docs and compatible pinned versions; note assumptions in `harness/progress.md`.

## Quality gate
For every implementation phase:
1. Identify relevant acceptance criteria from the active task.
2. Add or adjust tests for behavior and a failure case when feasible.
3. Run the relevant project's lint, test, and build commands when available.
4. Report commands executed and PASS/FAIL, with actual error messages if failed. Never claim tests passed if not run.
5. Review the diff for regressions, data exposure, unexpected files, and unrelated modifications.
6. Update `harness/progress.md` with completed work and known limitations.
7. End with: changes, test results, and three brief questions that check the user's understanding.

If asked for analysis, planning, or review only, do not modify implementation files.
