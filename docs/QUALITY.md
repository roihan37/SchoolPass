# Quality & Verification

## Development gate for each task
- Explain the API/database behavior and a negative case first.
- Run relevant `lint`, `test`, `build` commands available in client/server.
- Check git diff for secrets, unrelated work, and accidental configuration drift.
- Update task progress with exact PASS/FAIL and known gaps.

## Minimum critical tests
- Auth: wrong credentials => 401; missing JWT => 401.
- Authorization: parent cannot view other's children; teacher cannot decide another class's request.
- Domain: duplicate(student,date) => 409; invalid type/status => 400; rejection without reason => 400; final request cannot be decided again => 409; concurrent decisions only one succeeds.
- File: oversize/unsupported file rejected; unauthorised signed URL denied; object private.
- Queue: duplicate retries do not create duplicate Notification.
- Cache: summary reflects decision after invalidation (or documented bounded TTL behavior).

## Demo requirements
1. Seed fictional parent, teacher, two children.
2. Parent login, submit request.
3. Teacher login, approve request.
4. Parent sees status; P1 attachment and notification optional in initial demo.
5. Explain database relationships, DI, authz, tests, and tradeoffs.

Never claim production-ready; no load testing, external messaging, regulatory/privacy audits, or distributed transaction guarantee are in scope.
