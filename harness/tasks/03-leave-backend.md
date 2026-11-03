# Phase 03 - Leave Request Backend Workflow

## Goal
Implement parent request, visibility, and teacher final decision.

## Scope
- POST /leave-requests, GET list/detail, PATCH /:id/decision.
- DTO validation and server ownership/class checks.
- Handle duplicate(student,date) via unique database constraint (409).
- Conditional update for PENDING -> final state concurrency; reason required on rejection.
- Automated tests for positive/negative flows.

## Acceptance criteria
- Parent can submit one-day SICK/PERMISSION for own child.
- Another parent's child => 403/404 with consistent policy.
- Duplicate => 409 including simultaneous requests.
- Teacher for class can approve or reject once; different teacher denied; two decisions cannot both succeed.
- List/detail responses never expose unauthorized records.

## Learning checkpoint
Explain HTTP statuses, business rule location, transaction vs conditional update, concurrency, idempotency.
