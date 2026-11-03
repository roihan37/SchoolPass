# Phase 01 - Database Foundation

## Goal
Create exactly four Prisma models and a read-only student retrieval flow.

## Scope
- Read docs/DATABASE.md and docs/API.md.
- Configure pinned Prisma version and PostgreSQL driver adapter according to that version's *current* official NestJS guide; document it.
- User, SchoolClass, Student, LeaveRequest models, relations and constraints.
- Prisma migration, fictional seed with one Teacher, two Parents, two classes, three students.
- NestJS Prisma provider/module.
- First read-only endpoint: GET /students/mine, auth behavior may be staged with a temporary local dev fixture ONLY if it is explicitly marked temporary and removed in Phase 02. Prefer postponing protected endpoint until auth to avoid a fake security model.

## Acceptance criteria
- `prisma validate`, `prisma generate` and migration succeed.
- Database has correct FK and unique constraints; verify with a test or direct DB inspection.
- Seed creates correct parent-child and teacher-class relations.
- No invented auth security; no public endpoint exposing all children.
- Test an actual query via Prisma and explain equivalent SQL JOIN.

## Learning checkpoint
Explain Primary Key, Foreign Key, composite unique constraint, Prisma relation, migration, and PrismaService injection.
