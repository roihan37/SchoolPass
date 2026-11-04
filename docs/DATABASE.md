# Database Contract

Use PostgreSQL and Prisma; document the pinned Prisma version and adapter/configuration choices in the implementation phase. Avoid old Prisma config examples when using Prisma 7.

## Models (Phase 01 creates four core models)
- User: `id UUID PK`, `name`, `email UNIQUE`, `passwordHash`, `role(PARENT|TEACHER)`, `createdAt`.
- SchoolClass: `id UUID PK`, `name UNIQUE`, `teacherId FK User`.
- Student: `id UUID PK`, `name`, `parentId FK User`, `classId FK SchoolClass`.
- LeaveRequest: `id UUID PK`, `studentId FK Student`, `submittedById FK User`, `absenceDate DATE`, `type(SICK|PERMISSION)`, `reason`, `status(PENDING|APPROVED|REJECTED)`, `reviewedById FK User NULL`, `decisionReason NULL`, `reviewedAt NULL`, `createdAt`. UNIQUE(studentId,absenceDate).

## P1 models
- Attachment: `id UUID PK`, `leaveRequestId FK LeaveRequest UNIQUE`, `objectKey UNIQUE`, `fileName`, `mimeType`, `fileSize`. One attachment max per request. Object bytes live in private MinIO, not PostgreSQL. Implemented in Phase 05.
- Notification: `id UUID PK`, `userId FK User`, `leaveRequestId FK LeaveRequest`, `type(LEAVE_DECIDED)`, `message`, `readAt NULL`, `createdAt`. UNIQUE(userId,leaveRequestId,type) for idempotent insert.

## Indexes to consider
- LeaveRequest(studentId,absenceDate) UNIQUE; Student(parentId), Student(classId), LeaveRequest(status,createdAt), SchoolClass(teacherId).

## Consistency boundaries
- State change to APPROVED/REJECTED must use conditional update so concurrent decisions cannot overwrite each other.
- Outbox is an optional future improvement; direct enqueue after DB commit is a documented delivery gap if Redis is unavailable.
- Student belongs to one parent and one active class *only for this learning MVP*.
