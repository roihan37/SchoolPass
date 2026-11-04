# Architecture and Engineering Decisions

## Style
Modular monolith: React UI -> NestJS HTTP controllers -> services -> Prisma -> PostgreSQL.
NestJS also calls MinIO object storage and Redis; BullMQ worker process consumes jobs and writes Notification to PostgreSQL. BullMQ queue itself uses Redis.

## Why each dependency
- React: interface, forms, component design system.
- NestJS: API, DI, input validation, authentication/authorization, business rules.
- PostgreSQL: source of truth.
- Prisma: typed persistence and migrations, not a substitute for learning SQL.
- MinIO: private document storage, download via server-authorized short-lived signed URL.
- Redis: teacher dashboard summary cache with TTL and invalidation.
- BullMQ: asynchronous, retryable in-app notification job.
- Docker Compose: reproducible local supporting services and later full-stack run.

## Backend boundaries
Thin controllers, services own business logic, centralized Prisma access, DTO validation, guards plus record-level authorization in services. No external production credentials.

### Backend layout (implemented through Phase 06)
- `server/src/modules/`: feature modules `auth`, `students`, `leave-requests`, and operational `health`.
  Controllers handle HTTP; services own business rules and record-level authorization.
  Login DTO lives in `auth/dto/`; unit tests live beside their tested components.
- `server/src/infrastructure/database/`: PrismaModule, PrismaService, and database
  environment loading. Feature modules explicitly import PrismaModule, which exports
  PrismaService and owns connection/disconnection lifecycle through Nest DI.
- `server/src/infrastructure/storage/`: S3-compatible MinIO client provider and
  storage service. The bucket is created on first upload and no public access
  policy is configured. LeaveRequestsModule calls this adapter without owning
  SDK configuration.
- `server/src/infrastructure/redis/`, `cache/`, and `queue/`: Redis connection,
  cache-aside adapter, and BullMQ queue configuration/provider. Dashboard cache
  keys are scoped by teacher ID and expire after 60 seconds.
- `server/src/modules/notifications/` owns the authenticated notification list
  and job processor; `server/src/modules/dashboard/` owns teacher summaries.
  A unique notification constraint plus upsert makes job replay idempotent.
- `server/src/common/auth/`: shared guard, decorators, identity/request types, and
  safe identity projection (without passwordHash). Common components do not import
  feature services. AuthModule still owns APP_GUARD registration and JWT configuration;
  moving a provider file does not change its Nest module scope.
- `server/src/common/security/`: password hashing/verification shared by login and seed.
- `server/src/generated/prisma/`: ignored generated client; generator output and ESM
  `.js` imports remain unchanged. Do not edit generated files.
- `server/prisma/`: schema, migration history, fictional seed, and test preparation.
  `server/test/` holds cross-module HTTP/database tests; database-env unit tests live
  beside the infrastructure helper.
- `server/src/app.module.ts` composes feature modules; `main.ts` bootstraps the API.
  No generic repository/base-service layer or catch-all CommonModule is required.
- LeaveRequestsModule imports PrismaModule explicitly. Its service scopes reads
  by parent ownership or assigned class, maps unique violations to HTTP 409, and
  performs final decisions with a PENDING-conditional update inside a transaction.
  Existing database constraints are reused; Phase 03 needs no new migration.
  Phase 05 authorizes attachment upload/download, stores only metadata in
  PostgreSQL, and compensates for a failed metadata insert by deleting the
  uploaded object.

### API and worker processes
`main.ts` bootstraps the HTTP API; `worker.ts` bootstraps a Nest application
context without an HTTP listener. The worker imports only required providers,
rather than AppModule and its HTTP controllers/guards. Both processes share one
codebase and PostgreSQL; the API enqueues BullMQ jobs and the worker consumes
them through Redis. After a committed decision, API invalidates the assigned
teacher's dashboard key and enqueues `leave.decided`. Enqueue is a separate Redis
operation, so a process failure between the PostgreSQL commit and queue add can
lose the notification. A transactional outbox is a future reliability option.

## Frontend boundaries
React + Vite + TypeScript; use a small consistent design system (Button, TextInput, Select, StatusBadge, DataTable, Dialog) with explicit loading, error and empty states. Reusable UI; do not duplicate core server rules in client as the only validation.

## Conventions
Start with npm for fewer toolchains. Choose supported Node LTS and pin compatible versions. Document ESM/Prisma choices; no accidental major upgrade or mixing tutorials. Local Compose runs PostgreSQL, MinIO, and Redis.

## Security and reliability
JWT secrets stay local in .env (ignored); hash passwords. Avoid logging sensitive token/file data. File upload: size/type verification, private bucket, secure object keys, authorized access. Worker retries must not create duplicates. No public enrollment; seed only.
