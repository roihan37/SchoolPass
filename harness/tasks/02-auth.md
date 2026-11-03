# Phase 02 - Authentication and Authorization

## Goal
Secure the API with JWT and role + record-level authorization.

## Scope
- Login endpoint, password hashing for seeded accounts, JWT verification, current-user endpoint.
- Auth Guard and role checks; StudentsService returns only children of authenticated Parent.
- No public registration; no unsafe hard-coded token or secret; .env.example placeholders.

## Acceptance criteria
- Valid parent and teacher login succeed; wrong password => 401.
- Missing/invalid JWT => 401 on protected endpoints.
- Parent sees only their own children, with server-derived user id.
- Teacher cannot use parent-only endpoint; no data leaks.
- Lint/test/build pass or failures are fully reported.

## Learning checkpoint
Explain authentication vs authorization, signing vs decoding JWT, hashing, Guards, DTO validation.
