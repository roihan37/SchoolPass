# SchoolPass server

Ikuti AGENTS.md di root. Scope aktif Phase 05: penyimpanan lampiran privat MinIO
untuk leave request sesuai `harness/tasks/05-storage.md`.
Pertahankan fondasi Prisma Phase 01, autentikasi/otorisasi Phase 02, dan workflow
leave request Phase 03.
Fitur berada di `src/modules/`, integrasi di `src/infrastructure/`, dan komponen
lintas fitur di `src/common/`. Integrasi MinIO berada di
`src/infrastructure/storage/`. Jangan mulai fitur React baru, registrasi publik,
Redis, atau BullMQ pada fase ini.
