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

## Frontend boundaries
React + Vite + TypeScript; use a small consistent design system (Button, TextInput, Select, StatusBadge, DataTable, Dialog) with explicit loading, error and empty states. Reusable UI; do not duplicate core server rules in client as the only validation.

## Conventions
Start with npm for fewer toolchains. Choose supported Node LTS and pin compatible versions. Document ESM/Prisma choices; no accidental major upgrade or mixing tutorials. Local Docker initially runs Postgres only; add Redis and MinIO when phases require them to save device resources.

## Security and reliability
JWT secrets stay local in .env (ignored); hash passwords. Avoid logging sensitive token/file data. File upload: size/type verification, private bucket, secure object keys, authorized access. Worker retries must not create duplicates. No public enrollment; seed only.
