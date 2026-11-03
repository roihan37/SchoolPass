# SchoolPass Progress Log

## Current phase
02 - Authentication and Authorization (IMPLEMENTED AND VERIFIED, 2026-11-03)

Implementasi Phase 02 mendapat persetujuan eksplisit pengguna. Repository bersih
sebelum perubahan. Scope mengikuti `harness/tasks/02-auth.md`; tidak ditemukan
file rencana terpisah di repository. Tidak ada Git commit/push. Phase 03 belum dimulai.

## Phase 02 — changes and decisions
- `src/auth/`: module/service/controller, DTO login, global AuthGuard, decorator
  Public/Roles/CurrentUser, dan utility hash password. Login Parent/Teacher 200,
  salah password/email tak ditemukan 401 dengan pesan sama; me hanya identitas aman.
- Pin `@nestjs/jwt@12.0.3` (peer mendukung Nest 12), `class-validator@0.15.1`,
  `class-transformer@0.5.1`; tidak memasang Passport/layanan baru. Node 24.18.1,
  Nest 12.3.2, Prisma 7.10.1 dan ESM `.js` dipertahankan. Mengikuti
  [Nest JWT](https://github.com/nestjs/jwt),
  [Nest validation](https://docs.nestjs.com/techniques/validation), dan
  [Node 24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html).
- JWT HS256 berumur 900 detik; verifikasi membatasi algoritma, issuer/audience,
  UUID subject dan expiry wajib. Secret dari environment, minimum 32 byte,
  tanpa fallback; startup gagal jika kosong/pendek. `.env.example` hanya placeholder.
  `.env` lokal tidak diubah; smoke test memakai secret acak sementara melalui env.
- Guard melindungi seluruh route terdaftar secara default; health/login ditandai
  Public. Token hilang/rusak/kedaluwarsa/user tidak ada => 401; role salah => 403.
  User dan role dibaca dari database per request agar perubahan role tidak perlu
  menunggu token habis. Query database tambahan diterima untuk konsistensi demo.
- DTO email/password membatasi bentuk/panjang, menolak field tambahan. Email
  dicocokkan persis agar tidak mengubah kontrak unique database. `expectedType`
  eksplisit dan `@Inject` membuat validation/DI bekerja juga pada transform Vitest
  yang tidak menghasilkan metadata decorator TypeScript lengkap.
- Hash scrypt asynchronous, salt acak, timingSafeEqual; format Phase 01 dipakai
  kembali tanpa mereset password lama. Unknown account tetap melakukan scrypt
  memakai dummy hash acak untuk mengurangi perbedaan jalur verifikasi. Utility
  yang sama dipakai seed agar format penyimpanan dan verifikasi tidak berbeda.
- `src/students/`: GET `/api/v1/students/mine`, Parent saja. Service memeriksa
  role dan memfilter `parentId` dari user terverifikasi, bukan input query. Select
  hanya id/nama/classId/info kelas; tanpa akun parent lain atau password hash.
- Reuse PrismaModule/PrismaService; controller tetap tipis, service mengatur
  query/aturan akses. Tidak ada perubahan schema/migrasi, UI React, leave request,
  registrasi publik, MinIO, Redis atau BullMQ.
- `test/auth.db-spec.ts`: fixture fiktif UUID acak pada database `_test`, HTTP
  nyata dan Prisma/PostgreSQL; cleanup hanya fixture test sendiri. Memeriksa
  kedua role, validasi DTO, signature/expiry/issuer/audience/algoritma/subject,
  token tanpa expiry, user tidak ada, role terbaru dan isolasi dua Parent.
  Tes fondasi Phase 01 tetap dijalankan. Tidak menulis database produksi.
- README, docs/API.md, server/AGENTS.md dan .env.example diperbarui untuk setup,
  kontrak/status HTTP, scope aktif dan keterbatasan; tidak menyimpan secret/token.

## Phase 02 — actual verification
Perintah npm server dari `server/`, client dari `client/`; Node 24.18.1/npm 11.16.0.

| Command | Result |
|---|---|
| `npm install --save-exact @nestjs/jwt@12.0.3 class-validator@0.15.1 class-transformer@0.5.1` | PASS; tiga dependency langsung dipin dan lockfile diperbarui |
| `npm run format` | PASS; source/test/tool Prisma |
| `npm run lint` | PASS; 27 files, 0 errors/warnings |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS; 13 tests, 3 files |
| `npm run test:e2e` | PASS akhir; 4 tests, 1 file |
| `npm run test:db` | PASS akhir; 30 tests, 2 files (14 fondasi + 16 autentikasi/otorisasi), tanpa migrasi pending |
| `npm run build` | PASS; Prisma generate dan Nest build |
| `npx prettier --check --ignore-path ../.gitignore "src/**/*.ts" "test/**/*.ts" "prisma/**/*.ts" prisma.config.ts 'vitest.config*.ts'` | PASS |
| client: `npm run lint`, `npm run build` | PASS; frontend tetap tidak diubah |
| `docker compose ps` | PASS akhir; PostgreSQL healthy, 127.0.0.1:55432 |
| `node --input-type=module` smoke script: spawn `node dist/main.js`, PORT=3011, JWT_SECRET acak sementara | PASS; health/login Parent/Teacher/me/anak 200, tanpa token/password salah 401, Teacher pada students 403; proses dihentikan sesudah tes |
| `npm audit --omit=dev` | PASS; 0 vulnerabilities runtime |
| `npm audit` | FAIL exit 1; 2 moderate @nestjs/cli/minimatch, temuan dev lama |
| `git diff --check`, `git status --short`, `git check-ignore` | PASS; scope Phase 02, env/generated/build/tools tetap ignored |

## Phase 02 — failures and limitations
- Percobaan awal HTTP test dan database di sandbox gagal `listen EPERM: operation
  not permitted 127.0.0.1` / `connect EPERM 127.0.0.1:55432`. Docker socket juga
  ditolak sandbox. Diulang dengan izin akses lokal: semua test/health di atas lulus.
- Percobaan audit dalam sandbox gagal `ENOTFOUND registry.npmjs.org`; retry dengan
  izin jaringan berhasil. Audit penuh tetap gagal karena
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) pada dev
  dependency lama. Tidak melakukan downgrade major CLI atau `audit fix --force`.
- npm memperingatkan install scripts fsevents/prisma/@prisma/engines belum
  diizinkan; generate/build/test berhasil tanpa memberi izin tambahan.
- Root `.env` perlu diisi JWT_SECRET untuk menjalankan server sendiri. Password
  seed lama tetap berlaku; mengganti SEED_PASSWORD tidak mereset akun yang ada.
  Tidak menjalankan reset/migrasi development atau mengubah data production.
- Tidak ada refresh token, logout/revocation list atau rate limiting login.
  Token berakhir setelah 15 menit; rotasi secret membatalkan semua token lama.
  Belum siap produksi; fitur di luar scope memerlukan keputusan terpisah.
- Seluruh acceptance Phase 02 terpenuhi. Diff dan file baru ditinjau untuk scope,
  keamanan, file tak terkait dan secret; `git diff --check` lulus.
  Next: review manusia sebelum `harness/tasks/03-leave-backend.md`.

---

## Historical record — Phase 01 (2026-11-03)
Bagian berikut mencatat kondisi pada akhir Phase 01 sebelum implementasi auth.
Pernyataan auth belum tersedia hanya berlaku pada waktu itu. Implementasi Phase 01
disetujui melalui jawaban "ya" atas rencana.

## Phase 01 — changes and decisions
- `server/package.json`, lockfile: pin Prisma CLI/client/adapter-pg 7.10.1 dan
  pg/@types/pg 8.23.1. Node 24.18.1 memenuhi kebutuhan versi yang dipilih.
  Tidak mengikuti saran CLI upgrade ke Prisma 8.0.0-rc.30.
- Mengikuti [panduan NestJS Prisma 7](https://www.prisma.io/docs/guides/v7/frameworks/nestjs),
  [upgrade guide v7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), dan
  [generator](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators).
  Generator `prisma-client`, custom output TS dalam `src/generated/prisma`, ESM
  dengan import `.js`; adapter `PrismaPg` runtime. Generated files diabaikan Git.
- `server/prisma.config.ts`, `src/config/database-env.ts`: URL datasource di config,
  bukan schema. Node `process.loadEnvFile` memuat `.env` root tanpa dependency
  dotenv; environment shell menang. URL default dibentuk dari POSTGRES_* dengan
  encoding, host 127.0.0.1:55432. Jalankan npm dari server/.
- `server/prisma/schema.prisma`: tepat User, SchoolClass, Student, LeaveRequest;
  UUID PK, enum role/type/status, enam FK, email/nama kelas unique,
  UNIQUE(studentId,absenceDate), empat indeks pencarian. Absence memakai DATE,
  timestamp memakai timestamptz; review nullable, default PENDING. UUID default
  dihasilkan Prisma client; SQL manual harus memasok UUID sendiri.
- FK memakai ON DELETE RESTRICT agar data berelasi/riwayat tidak terhapus lewat
  cascade. FK memastikan referensi ada; role, kepemilikan dan keputusan izin
  menjadi tanggung jawab service/auth pada fase terkait.
- `server/prisma/migrations/20261103143733_init_database/migration.sql` dan lock:
  riwayat struktur awal PostgreSQL, diterapkan ke development dan database test.
- `server/prisma/seed*.ts`: seed transaksional/idempotent dengan UUID tetap,
  1 Teacher, 2 Parents, 2 kelas, 3 siswa; semua nama fiktif/email example.test.
  Tidak membuat leave request. Password seed lokal minimal 16 karakter, hash
  scrypt dan salt acak per pengguna baru; pengulangan mempertahankan hash lama.
  `.env.example` tanpa password nyata; SEED_PASSWORD acak hanya di `.env` ignored.
- `src/prisma/`: module mengekspor PrismaService sebagai provider DI; AppModule
  mengimpornya. Hook module init melakukan connect; module destroy disconnect;
  shutdown hooks diaktifkan. Health tetap liveness, startup memerlukan DB.
- `tsconfig.tools.json`: seed/test preparation dikompilasi TS ke `.prisma-tools`
  lalu dijalankan Node ESM. Tidak menambah runner TS atau mengubah output API.
- `test/database.db-spec.ts`, `prisma/prepare-test.ts`, config Vitest database:
  tes menggunakan PostgreSQL nyata terpisah dengan akhiran `_test`, bukan mock.
  Helper menolak nama yang sama dengan database utama; membuat DB bila belum ada,
  menjalankan migrate deploy, tanpa drop/reset. Fixture leave memakai rollback.
- Query Prisma terfilter parentId dibandingkan SQL parameterized JOIN Student ke
  SchoolClass lewat classId, lalu User lewat teacherId; hasil mencakup kelas/guru
  dan hanya siswa parent terkait. Verifikasi ini belum merupakan autentikasi.
- Endpoint students/mine ditunda sampai auth sesuai opsi tugas/rencana; tidak ada
  public endpoint siswa maupun fixture identitas HTTP. React/auth/MinIO/Redis/
  BullMQ tidak diimplementasikan. `server/AGENTS.md` diselaraskan ke scope Phase 01.
- README berisi bootstrap, migrate deploy vs migrate dev, seed dan tes. Format/lint
  mencakup tool Prisma dan mengecualikan generated client.

## Phase 01 — actual verification
Perintah npm dari server/; nvm dimuat dan Node 24.18.1 digunakan.

| Command | Result |
|---|---|
| `npm install --save-exact @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg@8.23.1` | PASS |
| `npm install --save-dev --save-exact prisma@7.10.1 @types/pg@8.23.1` | PASS |
| `npm run prisma:format`, `npm run prisma:validate`, `npm run prisma:generate` | PASS; Prisma 7.10.1 |
| `npm run prisma:migrate -- --name init_database` | PASS setelah retry di luar sandbox; migrasi awal diterapkan tanpa reset |
| `npm run prisma:seed` dua kali | PASS; tetap 3 users, 2 classes, 3 students; tanpa duplikasi |
| `npm run format` | PASS; generated client dikecualikan |
| `npm run lint` | PASS; 15 files, 0 errors/warnings |
| `npm test` | PASS; 5 tests, termasuk penolakan target database test yang tidak aman |
| `npm run test:db` | PASS akhir; 14 tests nyata PostgreSQL, seed/relasi/JOIN, P2002 unique, P2003 FK/Restrict, DATE/default/null, rollback, password kosong |
| `npm run test:e2e` | PASS; 4 tests (provider Prisma diganti untuk tes HTTP liveness); health 200, route lainnya 404 |
| `npm run build` | PASS; prebuild generate otomatis dan Nest build |
| `npm run prisma:status` | PASS akhir; 1 migration, database schema up to date |
| `docker compose ps` | PASS; PostgreSQL healthy pada 127.0.0.1:55432 |
| `PORT=3011 npm run start:prod` | PASS; build terbaru startup dan koneksi Prisma nyata berhasil; dihentikan Ctrl+C setelah verifikasi |
| `curl -i -fsS http://127.0.0.1:3011/api/v1/health` | PASS; 200, JSON status ok |
| curl `/api/v1/students/mine` dan `/health` pada 3011 | PASS; keduanya 404 |
| `npm audit --omit=dev` | PASS; 0 vulnerabilities runtime |
| `npm audit` | FAIL exit 1; 2 moderate Nest CLI/minimatch, temuan dev lama Phase 00 |
| `git diff --check`, ignore checks | PASS; .env, generated client dan tool output ignored |

## Phase 01 — failures and limitations
- Percobaan migrasi dalam sandbox gagal `P1001: Can't reach database server at
  127.0.0.1:55432`; retry dengan izin lokal di luar sandbox berhasil. Sebelum
  migrasi, inspeksi database development memastikan belum ada tabel public.
- Build API pada port 3001 gagal `EADDRINUSE: address already in use
  127.0.0.1:3001`. Respons curl pada 3001 tidak dipakai sebagai bukti build baru;
  diganti ke 3011 dan diulang dengan proses build yang berhasil startup.
- Audit penuh belum bersih: GHSA-g3hv-75wg-m249 melalui Nest CLI/minimatch.
  Tidak menjalankan audit fix --force yang menyarankan downgrade major CLI.
- npm memperingatkan script fsevents, prisma preinstall dan @prisma/engines
  postinstall belum diizinkan. Semua generate/migrate/seed/build/test di atas tetap
  berhasil; tidak memberi izin install script tambahan. Mesin baru memerlukan
  network untuk paket/engine pertama; npm ci Phase 01 belum diulang.
- Test DB khusus fixture mengharapkan jumlah data tepat; akun lokal membutuhkan
  CREATE DATABASE untuk preparation/shadow DB. Tidak ada drop/reset otomatis.
- Client tidak diubah, lint/build client tidak diulang pada Phase 01.
- Diff dan file baru ditinjau; perubahan Phase 00 dan .DS_Store yang sudah ada
  dipertahankan. Tidak ada kredensial nyata dalam file yang disiapkan untuk Git.
- Semua acceptance Phase 01 terpenuhi lewat query/test tanpa endpoint terlindungi
  palsu. Otorisasi role/kepemilikan, validasi DTO/aturan izin dan auth belum diuji
  karena belum diimplementasikan. Tunggu persetujuan sebelum fase berikutnya.

---

## Historical record — Phase 00 (2026-11-03)
Bagian berikut mencatat kondisi dan hasil pada akhir Phase 00, sebelum perubahan
Phase 01 di atas. Pernyataan Prisma belum terpasang/Phase 01 belum dimulai hanya
berlaku pada waktu itu. Implementasi Phase 00 mendapat persetujuan pengguna.

## Changed files and decisions
- `client/`: scaffold React 19.3.1 + Vite 8.3.5 + TypeScript 7.0.2 strict,
  halaman statis SchoolPass, Oxlint, versi langsung exact dan npm lockfile.
- `server/`: scaffold NestJS 12.3.2 + Nest CLI 12.0.11 + TypeScript 6.0.2 strict,
  ESM NodeNext, controller/service health, Vitest 4.1.12 dan Supertest 7.3.1.
  Import relatif `.js` cocok dengan output Node ESM; hasil build `dist/main.js`.
  Metadata decorator tetap aktif untuk dependency injection Nest.
- `.nvmrc`: Node 24.18.1; engines Node >=24.18.1 <25, npm >=11.16.0 <12;
  `.npmrc` root dan per aplikasi memakai save-exact dan engine-strict.
- `.gitignore`, `.env.example`, `compose.yaml`: hanya PostgreSQL 17.11-bookworm,
  named volume, healthcheck, port loopback 55432:5432. Password contoh kosong.
  Password acak hanya dibuat dalam `.env` lokal ignored (mode 0600), tidak dicetak.
- `README.md`, README aplikasi: perintah development dan quality gate yang teruji,
  arsitektur, batasan, ESM/Prisma, dan hasil audit.
- `docs/API.md`: pengecualian publik health sesuai rencana yang disetujui;
  hanya liveness proses API, belum memeriksa DB. Prefix tetap `/api/v1`.
- Prisma, model DB, JWT, Redis, MinIO, BullMQ dan fitur bisnis belum diimplementasikan.
- Generated Nest deploy/telemetry recommendation tidak diaktifkan; tidak ada
  layanan produksi atau telemetry tambahan.
- Port host 5432 sudah digunakan PostgreSQL lokal; Docker Desktop setelah aktif
  juga membuka port 3000 untuk proses lain. PostgreSQL SchoolPass memakai 55432,
  perintah API teruji memakai `PORT=3001`; default kode tetap 3000.

## Verified environment
- macOS 26.6.2 arm64, Node 24.18.1, npm 11.16.0.
- nvm 0.40.5 (perlu `source "$HOME/.nvm/nvm.sh"` pada shell tool).
- Git 2.50.1 (Apple Git-155), Python 3.9.6.
- Docker CLI/daemon 29.7.2, Docker Compose 5.5.1.
- PostgreSQL 17.11, Debian bookworm aarch64, dikonfirmasi query SQL.

## Actual commands and results
Perintah aplikasi dijalankan dari folder yang disebut; Docker dari root.

| Command | Result |
|---|---|
| `npx --yes --fetch-retries=0 --fetch-timeout=10000 create-vite@9.3.3 client --template react-ts --no-interactive` | PASS di luar sandbox; scaffold client |
| `npx --yes --fetch-retries=0 --fetch-timeout=10000 @nestjs/cli@12.0.11 new server --package-manager npm --skip-git --skip-install --strict` | PASS di luar sandbox; scaffold server |
| `npm install` di client dan server | PASS akhir; lockfile dibuat |
| `npm ci --ignore-scripts`, lalu `npm ci` standar, masing-masing aplikasi | PASS; reproducibility dari lockfile |
| `source "$HOME/.nvm/nvm.sh"`, `nvm --version`, `nvm use` | PASS; 0.40.5, Node 24.18.1/npm 11.16.0 |
| `node --version`, `npm --version`, `git --version`, `python3 --version`, `docker --version`, `docker compose version` | PASS; versi di atas |
| client: `npm run lint && npm run build` | PASS akhir setelah npm ci; 17 modul, build Vite berhasil |
| server: `npm run format` | PASS; Prettier source dan test |
| server: `npm run lint && npm test && npm run test:e2e && npm run build` | PASS akhir; 0 lint warning/error; 1 unit test, 3 e2e tests lulus; build Nest berhasil |
| `docker desktop start`, `docker info --format '{{.ServerVersion}}'` | PASS; daemon 29.7.2 berjalan |
| `docker compose config --quiet` | PASS dengan .env lokal |
| `docker compose --env-file .env.example config --quiet` | PASS kasus negatif: ditolak exit 1 karena password kosong |
| `docker compose up -d --wait`, `docker compose ps` | PASS; `schoolpass-postgres-1` healthy, 127.0.0.1:55432->5432 |
| `docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" && psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();"'` | PASS; accepting connections, PostgreSQL 17.11 |
| server: `PORT=3001 npm run start:prod` | PASS; hasil build dijalankan dan health diperiksa |
| server: `PORT=3001 npm run start:dev` | PASS; watch compile 0 error dan health diperiksa |
| `curl -i -fsS http://127.0.0.1:3001/api/v1/health` | PASS; HTTP 200, JSON `{"status":"ok"}` |
| `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/v1/missing` | PASS; 404 |
| `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/health` | PASS; 404 |
| client: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` | PASS; Vite ready |
| `curl -fsS http://127.0.0.1:5173/` dan `curl -fsS http://127.0.0.1:5173/src/App.tsx` | PASS; HTML SchoolPass dan TSX ditransformasikan |
| server: `npm audit --omit=dev` | PASS; 0 vulnerabilities runtime |
| npm audit otomatis saat install/ci client | PASS; 0 vulnerabilities |
| server: `npm audit` akhir | FAIL exit 1; 2 moderate pada Nest CLI/minimatch (dev only), detail di bawah |
| `git diff --check`, `git check-ignore .env client/node_modules server/node_modules client/dist server/dist` | PASS; whitespace tracked diff bersih dan file lokal/build/dependencies ignored |

## Failures encountered and recovery
- npx awal di sandbox: `ENOTFOUND registry.npmjs.org`. Diulang dengan izin network
  di luar sandbox, berhasil; tidak ada klaim bahwa percobaan awal berhasil.
- Docker awal: `Cannot connect to the Docker daemon ... docker.sock`;
  `docker desktop status` di sandbox juga tidak bisa menulis log Docker Desktop.
  `docker desktop start` di luar sandbox berhasil; container/SQL akhirnya teruji.
- Instalasi server pertama: `ETARGET No matching version found for
  @types/supertest@7.0.0`. Diperbaiki ke versi tersedia 7.2.1.
- Template Supertest 7.0.0 deprecated; diperbarui ke 7.3.1.
- Audit server awal: 6 temuan (5 moderate, 1 high). Vite 8.0.0 dan Vitest 4.1.2
  bawaan template dipatch ke Vite 8.3.5, Vitest/coverage 4.1.12.
- E2E awal: 3 gagal dengan `listen EPERM: operation not permitted 0.0.0.0`
  dan efek lanjut `Cannot read properties of null (reading 'port')`.
  Diulang di luar sandbox: 3/3 lulus tanpa perubahan assertion.
- `npm run start:prod` dan `npm run start:dev` awal pada port default gagal
  `EADDRINUSE 127.0.0.1:3000`. Tidak menghentikan proses lain; port 3001 berhasil.
- `nvm` belum otomatis dimuat (`command not found`); source nvm.sh menyelesaikannya.
- npm ci sempat dijalankan ketika watch aktif: TypeScript sementara melaporkan
  `TS2318 Cannot find global type 'Array'` dan `TS2688` saat node_modules diganti.
  Setelah instalasi selesai watch kembali 0 error dan health berhasil; quality
  gate akhir diulang dan lulus. README meminta menghentikan watch sebelum npm ci.
- `ps` di sandbox ditolak; tidak diperlukan untuk acceptance. Aplikasi pengujian
  dihentikan dengan Ctrl+C; PostgreSQL dibiarkan berjalan dengan volume lokal.

## Acceptance review and limitations
- Install/ci kedua aplikasi, lint/build kedua aplikasi, PostgreSQL healthy,
  SQL dan HTTP health 200 semuanya terpenuhi. Kasus negatif HTTP 404 dan konfigurasi
  tanpa password juga teruji. Tidak ada model/migrasi/integrasi Prisma atau fase lain.
- Tidak ada test runner client atau tes browser otomatis pada Phase 00; frontend
  diverifikasi lewat lint, build dan HTTP/transform smoke check. Tes domain/auth
  di QUALITY.md berlaku pada fase implementasi fitur terkait.
- Full audit server belum bersih: minimatch <11.0.1 melalui @nestjs/cli 12.0.11,
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  npm menyarankan downgrade major CLI ke 11.0.24; tidak memakai `audit fix --force`
  atau override major transitive yang belum divalidasi. Tinjau upstream sebelum
  menggunakan tooling dengan glob dari sumber tidak tepercaya.
- npm 11 memperingatkan install script opsional fsevents@2.3.3 belum disetujui;
  tidak diberi izin tambahan karena lint/build/watch/test tetap bekerja.
- `.DS_Store` root sudah tracked pada baseline dan berubah selama sesi dari proses
  lingkungan; tidak diubah lewat kode atau direstore. .gitignore mencegah file baru
  sejenis tetapi tidak menghapus file yang sudah tracked.
- Prisma belum dipilih/diinstal. Kandidat stabil saat discovery 7.10.1; hindari
  rilis 8 prerelease, verifikasi ulang kebutuhan Node/ESM, config, generated output
  dan PostgreSQL adapter saat Phase 01 mendapat persetujuan.
- Direct DB-commit-then-queue-enqueue tidak atomic; tetap risiko untuk fase P1.

## Learning checkpoint and next step
Vite mengembangkan/membangun React; module Nest merangkai controller/provider,
controller memetakan HTTP dan service dipasok melalui DI. Image adalah template,
container proses berjalan, volume menyimpan data, mapping menghubungkan port host
ke container, healthcheck memeriksa kesiapan PostgreSQL. Health API terpisah dari
readiness DB. Detail arsitektur tersedia di README.

Next: tunggu review manusia dan persetujuan eksplisit sebelum Phase 01.
