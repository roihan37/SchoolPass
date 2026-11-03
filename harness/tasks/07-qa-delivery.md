# Phase 07 - Integration QA and Demo

## Goal
Make SchoolPass repeatably runnable, verifiable, and interview-demo-ready.

## Scope
- Integration tests and critical negative security cases from docs/QUALITY.md.
- End-to-end smoke test Parent->Teacher->Parent.
- Complete Docker Compose services including frontend/API/worker, or document a tested hybrid local workflow if full containers are too resource intensive.
- README: prerequisites, env.example, install, DB migration/seed, run, lint/test/build, demo accounts (fictional), known limitations.
- Record architecture decision notes and a 5-minute technical demo outline.

## Acceptance criteria
- Repeatable setup using documented commands on a clean checkout (as far as environment allows).
- Test status is evidence-based, no fabricated PASS.
- No secrets, no real student data, no exposed MinIO bucket.
- User can explain authz, business rules, job retries, cache invalidation, and trade-offs.

## Learning checkpoint
Explain SDLC artifacts, CI gates, Docker networking, readiness vs liveness, and bug-triage process.
