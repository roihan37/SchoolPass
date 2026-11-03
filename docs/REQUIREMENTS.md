# SchoolPass Requirements

## Core flow
1. Seed PARENT, TEACHER, SchoolClass, Student.
2. Parent signs in and retrieves own child/children.
3. Parent creates leave request for one `absenceDate`, with `type` SICK or PERMISSION and nonempty `reason`. Initial status is PENDING.
4. Teacher signs in; can list/review only requests for assigned classes.
5. Teacher decides APPROVED or REJECTED. For REJECTED, `decisionReason` is required. Decision is final in this MVP.
6. Parent sees the status from the database.
7. Optional P1: parent uploads one private supporting file while request is pending; teacher/parent access only after server authorization; approved/rejected decision causes in-app notification; dashboard summary uses cache.

## Business rules
- BR01: Parent must own the target Student. No `parentId` from client can override authenticated identity.
- BR02: A Student can have at most one leave request per calendar date: database UNIQUE(studentId, absenceDate).
- BR03: Only assigned Teacher can read or decide a class's requests.
- BR04: Only PENDING can transition to APPROVED or REJECTED. Use a conditional DB write for concurrent decisions.
- BR05: Rejection requires a reason; approval reason optional.
- BR06: Private attachments are accessible only to owning parent and class teacher. Do not expose public MinIO buckets.
- BR07: Notification processing may retry; unique DB constraint prevents duplicates.
- BR08: Use fictional seed records; no real sensitive student data.

## Nonfunctional requirements
- TypeScript strict; meaningful validation and HTTP statuses.
- Modular architecture, clear error paths, no secret leakage.
- Responsive UI with reusable components, loading/error/empty states.
- Repeatable build/test and Docker-based local services.

## Acceptance scenarios
- Parent can authenticate and see only own students.
- Parent can create a request, then list and inspect it.
- Second request for same student/date is rejected with HTTP 409.
- Another parent cannot create/read a request for unrelated student (403 or 404 per API policy, consistently applied).
- Teacher for unrelated class cannot approve or read a student's request.
- Two simultaneous decisions cannot both succeed.
- Retry of a notification job does not duplicate its DB record.
