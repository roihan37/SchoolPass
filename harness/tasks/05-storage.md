# Phase 05 - MinIO Attachment

## Goal
Implement one optional, private supporting document per pending request.

## Scope
- Add private MinIO service to Docker Compose; bucket private.
- Add Attachment model with one-to-one relation and migration.
- POST /leave-requests/:id/attachment and GET /leave-requests/:id/attachment-url.
- Validate file size (max 5 MB), supported formats PDF/JPEG/PNG by content type AND magic bytes where feasible, safe object key, ownership before signing.
- Handle compensation/cleanup on partial failed upload + DB operation.

## Acceptance criteria
- Authorized parent upload succeeds while PENDING, Teacher with class access can view.
- Unrelated parent/teacher cannot receive URL.
- Invalid type/oversized upload rejected; object not public.
- Demo shows file and matching DB metadata.

## Learning checkpoint
Explain object storage vs relational storage, multipart upload, presigned URL, authorization, cleanup.
