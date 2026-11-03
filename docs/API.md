# REST API Contract

Prefix: `/api/v1`. Require JWT except login and public liveness `/health`. Phase 00 health checks the API process only, not database readiness.

| Method | Path | Actor | Purpose |
|---|---|---|---|
| GET | /health | Public | Liveness: 200 with `{ "status": "ok" }` |
| POST | /auth/login | Public | Authenticate email/password, issue JWT |
| GET | /auth/me | Auth | Identity and role |
| GET | /students/mine | Parent | Own children only |
| POST | /leave-requests | Parent | One-day request, status=PENDING |
| GET | /leave-requests | Parent/Teacher | Filter by ownership/class |
| GET | /leave-requests/:id | Parent/Teacher | Authorized detail |
| PATCH | /leave-requests/:id/decision | Teacher | APPROVED/REJECTED (once) |
| POST | /leave-requests/:id/attachment | Parent | Upload optional file while pending (P1) |
| GET | /leave-requests/:id/attachment-url | Parent/Teacher | Authorized signed download (P1) |
| GET | /dashboard/summary | Teacher | Own class counts, cached (P1) |
| GET | /notifications | Auth | Own notifications (P1) |
| PATCH | /notifications/:id/read | Auth | Mark own notification read (P1) |

Expected errors: validation 400; authentication 401; forbidden 403; not found 404; duplicate/decided 409. Be consistent and document deliberate decisions to avoid revealing existence of unauthorized data.

Example request: POST /leave-requests JSON `{ "studentId": "<uuid>", "absenceDate": "2026-11-04", "type": "SICK", "reason": "Demam" }`.
Example decision: PATCH /leave-requests/:id/decision JSON `{ "status": "REJECTED", "decisionReason": "Lampiran perlu diperbarui" }`.
