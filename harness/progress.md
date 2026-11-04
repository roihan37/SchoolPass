# SchoolPass Progress Log

## Current phase
05 - Private MinIO Attachments (IMPLEMENTED; verification recorded below).
Tidak ada commit atau push. Catatan phase sebelumnya merupakan riwayat.

## Login security — rate limiting
- Login membatasi maksimal 10 percobaan per kombinasi IP dan email selama 15
  menit. Percobaan valid menghapus penghitung; attempt ke-11 menerima HTTP 429
  dengan `retryAfterSeconds`. Kegagalan koneksi Redis memberi HTTP 503 secara
  fail-closed agar batas keamanan tidak bisa dilewati saat cache mati.
- Redis Lua script menjalankan INCR, set expiry, dan membaca TTL sebagai satu
  operasi atomik. Kunci Redis berisi SHA-256 dari IP/email lowercase agar data
  mentah tidak tampak pada nama key. Tidak mengubah skema database atau menambah
  dependency. IP didapat dari request yang dilihat Nest; deployment di belakang
  reverse proxy perlu mengonfigurasi trusted proxy sesuai topologi.
- Cakupan per IP/email mengurangi dampak salah satu orang berbagi NAT, namun
  percobaan terdistribusi dengan IP berbeda tidak digabung menjadi satu akun.

### Verifikasi aktual
Perintah dijalankan dari `server/`:

| Command | Hasil |
|---|---|
| `npm run lint` | PASS; 60 files, 0 warning/error |
| `npm test -- src/modules/auth/login-attempt-limiter.service.spec.ts` | PASS; 4 tests, termasuk batas 10/11, key tersamarkan, reset sukses, dan Redis error 503 |
| `npm run test:db` | PASS; 85 tests, 4 files; migration database test sudah mutakhir |
| `npm run build` | PASS; Prisma Client 7.10.1 dan Nest build |
| `git diff --check` | PASS |

## Phase 05 — changes and decisions
- Compose kini menjalankan PostgreSQL dan MinIO lokal. MinIO API/Console hanya
  bind ke loopback (`9000`/`9001`), memakai volume persisten, dan bucket dibuat
  privat saat upload pertama. Credential MinIO lokal ada di `.env` yang ignored;
  `.env.example` hanya memberi nilai contoh tanpa password.
- Image MinIO dibangun dari source pada commit upstream yang dipin karena image
  rilis lama yang diperiksa tidak tersedia. Container berjalan sebagai user
  non-root. Upstream MinIO sudah diarsipkan; image ini perlu ditinjau/ditukar
  dengan distribusi storage yang dipelihara sebelum penggunaan produksi.
- Menambahkan model Attachment satu-ke-satu dengan LeaveRequest, unique
  `leaveRequestId` dan `objectKey`, serta FK `ON DELETE RESTRICT`. Bytes berada
  di object storage, sedangkan PostgreSQL menyimpan metadata.
- Endpoint Parent mengunggah maksimal satu PDF/JPEG/PNG berukuran 5 MiB saat
  pengajuan masih PENDING. MIME dan magic bytes diperiksa. Kunci object acak
  dibuat server; metadata tidak mengungkap object key. URL unduh berumur 300
  detik hanya ditandatangani setelah service memeriksa pemilik Parent atau kelas
  Teacher yang ditugaskan. Jika insert metadata gagal, object dihapus sebagai
  kompensasi (kegagalan cleanup dicatat tanpa data sensitif).
- MinIO diisolasi pada `infrastructure/storage`; leave-request service tetap
  memegang aturan bisnis/otorisasi. Tidak menambah UI, Prisma model lain, Redis,
  MinIO client side SDK, BullMQ, atau worker.

## Phase 05 — actual verification
Perintah server dijalankan dari `server/`, repository root untuk Compose.

| Command/check | Result |
|---|---|
| `npm run prisma:format && npm run prisma:validate && npm run prisma:generate` | PASS; Prisma 7.10.1, schema valid |
| `npm run lint` | PASS; 39 files, 0 errors/warnings |
| `npm test` | PASS; 13 tests, 4 files |
| `npx tsc --noEmit && npx tsc --noEmit -p tsconfig.tools.json` | PASS |
| `npm run test:e2e` | PASS; 6 tests |
| `npm run build` | PASS; Prisma generate and Nest build |
| `docker compose config --quiet && docker compose up -d --build --wait && docker compose ps` | PASS; MinIO image built locally; PostgreSQL and MinIO healthy/running |
| `npm run prisma:deploy` | PASS; attachment migration applied |
| `npm run test:db` | PASS; 77 tests, 3 files against PostgreSQL `_test`; both migrations applied |
| `curl -sS -o /dev/null -w 'MinIO liveness HTTP %{http_code}\\n' http://127.0.0.1:9000/minio/health/live` | PASS; HTTP 200 |
| Built `MinioStorageService` direct smoke: upload, signed GET, byte comparison, delete | PASS; GET HTTP 200, bytes match, cleanup completed |
| `git diff --check` | PASS |

Sandbox initially denied local network/Docker socket access (`EPERM`); affected
commands were rerun with approved local access and passed. Earlier e2e retry also
fixed a cyclic Nest provider import by moving the S3 token to its own file.
Initial typecheck/lint surfaced missing Multer type inclusion and a lint warning;
both were fixed and final checks passed.

## Phase 05 — limitations
- Automated database HTTP tests replace MinIO with a storage mock. The real
  MinIO adapter was separately exercised for upload, signed download, byte
  integrity, and cleanup; the complete HTTP endpoint with PostgreSQL and MinIO
  together was not separately exercised. Browser access to presigned URLs also
  needs MinIO CORS configuration for the frontend origin.
- The upstream source build makes the demo reproducible at a pinned commit but
  can take several minutes and the archived MinIO project does not receive
  ongoing security updates. Do not treat this image as a production deployment.
- Uploaded file bytes use Multer memory storage, capped at 5 MiB; this is
  appropriate for the requested demo limit but should be revisited for larger
  files/concurrent production traffic.

## Phase 04 — changes and decisions
- Mengganti placeholder React dengan login dan dashboard berbasis role Parent/Teacher.
  Parent dapat memilih anak, membuat pengajuan, melihat riwayat dan detail; Teacher
  melihat daftar, memutus PENDING, dan wajib memberi catatan saat menolak.
- API client terpusat dan bertipe untuk login, students/mine, leave list/create,
  dan decision. Token disimpan hanya di state memori; setiap role/resource tetap
  divalidasi server-side. 401 mengakhiri sesi; pesan backend/network/validasi
  terlihat di UI. API base bisa dikonfigurasi lewat VITE_API_BASE_URL.
- Komponen Button/Input/Select/StatusBadge/DataTable/Notice/SectionHeading dan
  token warna/tipografi dibuat dekat aplikasi; loading/error/empty/success state,
  label form, fokus keyboard, reduced motion, serta breakpoint responsif disediakan.
- Respons leave list backend tidak menyertakan nama/kelas siswa. Teacher melihat
  pengenal UUID singkat, bukan nama yang tidak dikirim API; tidak memperluas scope
  backend. API backend menjadi sumber otorisasi.
- Tidak menambah dependency. `client/package.json` belum memiliki test runner;
  smoke UI dilakukan di Chrome. Login/dashboard terintegrasi penuh memerlukan API
  dan seeded database yang aktif.

## Phase 04 — actual verification
Perintah dijalankan dari `client/`, Node/npm sesuai environment Phase 03.

| Command/check | Result |
|---|---|
| `npm run lint` | PASS; oxlint tanpa error/warning |
| `npm run build` | PASS; `tsc -b` dan Vite build (`19 modules transformed`) |
| `git diff --check` | PASS |
| Chrome smoke `http://127.0.0.1:5173/` | PASS; halaman login, heading, label email/password, tombol masuk muncul; console tanpa warning/error |
| `curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' http://127.0.0.1:3001/api/v1/health` | FAIL; HTTP 000, tidak dapat connect karena backend lokal tidak aktif |

## Phase 04 — limitations
- Tidak ada test runner React saat ini; tidak ditambahkan dependency baru sesuai
  batas minimal scope. Core flow Parent → Teacher → Parent belum diuji
  end-to-end; lint/build, render login, dan CORS sudah diverifikasi, tetapi bukan
  bukti alur bisnis login sampai keputusan cuti secara penuh.
- Perubahan backend hanya mengaktifkan CORS lokal; kontrak API/bisnis tidak
  diubah. Nama siswa tidak tersedia pada response daftar leave untuk tampilan
  Teacher, sehingga UI memakai ID singkat.

## Phase 04 — local CORS integration fix
- Setelah frontend melaporkan gagal koneksi, pemeriksaan menunjukkan health API
  sempat 200 tetapi browser preflight `OPTIONS` menerima 404. Menambahkan
  allowlist CORS untuk `http://127.0.0.1:5173` dan `http://localhost:5173`,
  tanpa credentials; origin lokal lain tidak diberi header CORS.
- `server/src/common/http/cors.ts` dipakai oleh bootstrap API dan e2e supaya
  aturan yang dites sama dengan konfigurasi production entry point.
- Verifikasi: `npm run lint` PASS (37 file); `npm test` PASS (13 tes/4 file);
  `npm run test:e2e` PASS (6 tes); `npm run build` PASS. Percobaan awal e2e di sandbox gagal `listen EPERM`;
  pengulangan dengan izin localhost PASS.
- Smoke check terhadap API `PORT=3001`: preflight dari Vite `204` dengan
  `Access-Control-Allow-Origin`, methods dan headers yang diperlukan; health
  `200`; `http://example.test` tidak mendapat `Access-Control-Allow-Origin`.
- Server development sedang berjalan pada `127.0.0.1:3001`; hentikan dengan
  Ctrl+C pada terminal prosesnya.

## Phase 03 — changes and decisions
- Baseline awal HEAD `71c4f83` bersih tetapi typecheck gagal TS2307 pada
  controller duplikat `server/src/auth/auth.controller.ts` (import service,
  decorator, dan DTO yang sudah pindah). Pengguna menyetujui perbaikan baseline:
  controller lama dihapus; controller aktif di `src/modules/auth/` dipertahankan.
  `server/AGENTS.md` diselaraskan dengan scope Phase 03 yang disetujui.
- Menambah LeaveRequestsModule/service/controller dan DTO di
  `server/src/modules/leave-requests/`, dirangkai melalui AppModule.
  Controller menangani HTTP/validasi; service mengatur akses dan aturan bisnis;
  PrismaModule menyediakan koneksi melalui dependency injection eksplisit.
- POST Parent menerima studentId, tanggal kalender YYYY-MM-DD, SICK/PERMISSION,
  dan alasan. Identitas pengaju berasal dari guard; status awal memakai default
  PENDING database. Tanggal disimpan UTC midnight untuk kolom DATE dan dikirim
  sebagai YYYY-MM-DD agar tidak bergeser karena zona waktu.
- GET list/detail memfilter kepemilikan Parent sekaligus pengaju, atau kelas
  Teacher pada query database. Resource tidak ditemukan maupun di luar akses
  menghasilkan 404; role salah 403. Respons hanya scalar LeaveRequest, tanpa
  relasi User/password/token. Query klien tidak dapat memperluas scope akses.
- Constraint UNIQUE(studentId, absenceDate) yang sudah ada dipakai langsung;
  error Prisma P2002 menjadi 409, termasuk pengajuan bersamaan. Tidak perlu
  dependency, perubahan schema, ataupun migrasi baru; Prisma tetap 7.10.1.
- Keputusan Teacher menggunakan updateMany bersyarat status PENDING dan kelas
  yang ditugaskan. Count nol menghasilkan 409; transaksi menyatukan update dan
  pembacaan hasil. Transaksi tanpa syarat PENDING tidak cukup mencegah overwrite.
  Reviewer/waktu berasal dari server; penolakan wajib alasan, approval opsional.
  Retry terhadap keputusan final menghasilkan 409 tanpa perubahan data.
- DTO menolak field tambahan, UUID/tanggal/enum tidak valid, alasan kosong/null;
  alasan maksimal 2000 karakter dan dipangkas saat disimpan. Batas panjang ini
  adalah pilihan validasi defensif, didokumentasikan di API; tidak menambah
  batas tanggal lampau/mendatang yang belum diminta.
- Menambah 44 tes PostgreSQL + HTTP nyata: alur positif, validasi, JWT/role,
  kepemilikan dan kelas, list/detail, duplikasi dan keputusan final termasuk race.
  Menggunakan database terpisah `_test`, UUID dan akun fiktif; cleanup hanya
  fixture sendiri. Tidak menyentuh data produksi atau mengubah seed lokal.
- README dan docs/API.md/ARCHITECTURE.md diperbarui dengan kontrak, struktur,
  contoh curl dan batasan. Mengikuti dokumentasi resmi Prisma Client v7 dan
  Nest ValidationPipe (tautan pada docs/API.md).

## Phase 03 — actual verification
Perintah npm dijalankan dari `server/`, Node 24.18.1/npm 11.16.0.

| Command | Result |
|---|---|
| `npx prettier --write test/leave-requests.db-spec.ts` | PASS; format akhir diperbaiki |
| `npx prettier --check src/modules/leave-requests src/app.module.ts test/leave-requests.db-spec.ts` | PASS |
| `npm run lint` | PASS; 36 files, 0 errors/warnings |
| `npx tsc --noEmit` | PASS |
| `npx tsc --noEmit -p tsconfig.tools.json` | PASS |
| `npm test` | PASS; 13 tests, 4 files |
| `npm run test:e2e` | PASS akhir; 4 tests, 1 file, termasuk GET /api/v1/health |
| `npm run test:db` | PASS akhir; 74 tests, 3 files (44 tes workflow baru); Prisma generate/tooling build/migrate deploy berhasil; tidak ada pending migration |
| `npm run build` | PASS; Prisma generate 7.10.1 dan Nest build |
| `docker compose ps` dari root | PASS; PostgreSQL healthy pada 127.0.0.1:55432 |
| `git diff --check` dan review seluruh perubahan/file baru | PASS; hanya scope Phase 03 dan perbaikan baseline yang disetujui, tanpa secret/dependency/schema baru |

Seluruh acceptance criteria TASK 03 terverifikasi: pengajuan anak sendiri,
penolakan akses anak/kelas lain, duplikasi termasuk race, hanya satu keputusan
final termasuk race, alasan penolakan, serta isolasi list/detail.

## Phase 03 — failures and limitations
- Baseline TS2307 di controller lama diselesaikan setelah persetujuan pengguna.
  Typecheck tes baru sempat FAIL TS2345 karena helper body bertipe unknown;
  diperbaiki menjadi object. Lint awal memiliki dua warning sort angka tanpa
  comparator; comparator ditambahkan. Prettier sempat FAIL pada file tes baru;
  format diperbaiki dan check akhir PASS.
- Percobaan test:db awal FAIL `connect EPERM 127.0.0.1:55432`; test:e2e awal
  FAIL `listen EPERM: operation not permitted 127.0.0.1`. Keduanya diulang dengan
  izin akses lokal di luar sandbox dan PASS; tidak mengubah konfigurasi aplikasi
  untuk melewati pemeriksaan keamanan.
- Tidak menambah pagination/filter, perubahan ownership/class, frontend, MinIO,
  Redis, BullMQ, worker, ataupun fase lain. Client dan dependency tidak berubah;
  pemeriksaan client/audit dependency tidak diulang. Riwayat audit Phase 02 tetap
  berlaku sebagai catatan sebelumnya, bukan hasil audit baru.
- Belum ada load test atau klaim kesiapan produksi. Perubahan selesai untuk
  review; fase selanjutnya memerlukan instruksi pengguna.

## Backend structure refactor — changes and decisions
- Rencana struktur mendapat persetujuan eksplisit pengguna; working tree bersih
  sebelum perubahan. Tidak ada commit/push, dependency baru, atau upgrade versi.
- Fitur auth, students, dan health berada di `server/src/modules/`; health
  dipisahkan dari AppController/AppService menjadi HealthModule. AppModule hanya
  merangkai ketiga module. Controller tetap tipis dan aturan akses tetap di service.
- PrismaModule/PrismaService serta helper environment pindah ke
  `src/infrastructure/database/`. Module fitur mengimpor PrismaModule secara
  eksplisit; lifecycle koneksi dan output generated client tidak berubah.
- Guard/decorator/tipe identitas/projection aman berada di `src/common/auth/`.
  Registrasi APP_GUARD dan konfigurasi JWT tetap dalam AuthModule supaya scope DI
  jelas. Guard tidak mengimpor AuthService; projection identitas bersama tetap
  mengecualikan passwordHash. Hash password dipindah ke `common/security/` agar
  seed tidak bergantung pada module fitur.
- DTO login dekat fitur auth; unit test dipindah dekat komponen masing-masing.
  Tiga kasus konfigurasi secret dipisahkan dari test password ke auth.config.spec.ts.
  Tes lintas module tetap di `server/test/`; jumlah assertion/test tidak berkurang.
- Import Node ESM `.js`, Prisma CLI config, seed, preparation test, dan konfigurasi
  compiler tooling disesuaikan. Schema/migrasi, kontrak API, serta frontend tidak
  berubah. Tidak membuat folder kosong, Redis, MinIO, BullMQ atau proses worker.
- README dan docs/ARCHITECTURE.md mendokumentasikan struktur serta rencana worker
  terpisah pada fase queue; belum ada implementasi worker maupun fitur fase lain.

## Backend structure refactor — actual verification
Perintah npm dijalankan dari `server/`, Node 24.18.1/npm 11.16.0.

| Command | Result |
|---|---|
| `npm run format` | PASS |
| `npm run lint` | PASS; 30 files, 0 errors/warnings |
| `npx tsc --noEmit` | PASS |
| `npx tsc --noEmit -p tsconfig.tools.json` | PASS |
| `npm test` | PASS; 13 tests, 4 files |
| `npm run test:e2e` | PASS akhir; 4 tests, 1 file |
| `npm run test:db` | PASS akhir; 30 tests, 2 files; migrasi database `_test` tidak memiliki pending migration |
| `npm run build` | PASS; Prisma generate 7.10.1 dan Nest build |
| `npx prettier --check --ignore-path ../.gitignore 'src/**/*.ts' 'test/**/*.ts' 'prisma/**/*.ts' prisma.config.ts 'vitest.config*.ts'` | PASS |
| `docker compose ps` dari root | PASS akhir; PostgreSQL healthy pada 127.0.0.1:55432 |
| Smoke script Node: `node dist/main.js`, port 3013, database `_test`, secret acak sementara | PASS; health/login Parent dan Teacher/me/anak 200; password salah dan tanpa token 401; Teacher mengakses students 403; passwordHash tidak dikembalikan; fixture dibersihkan dan proses dihentikan |
| `git diff --check`, review import dan seluruh file baru/perubahan | PASS; tidak ada perubahan schema, dependency, secrets, atau file di luar scope |

## Backend structure refactor — failures and limitations
- Percobaan awal perintah npm dari root gagal `ENOENT` karena tidak ada package.json
  root; proses dihentikan dan diulang dari `server/`, tanpa instalasi dependency.
- Sandbox menolak HTTP `listen EPERM`, koneksi database `connect EPERM
  127.0.0.1:55432`, dan Docker socket. Tes HTTP/database, Docker check serta smoke
  test diulang dengan izin akses lokal di luar sandbox dan berhasil.
- Tes database menggunakan database `_test` dan fixture fiktif; database produksi
  tidak disentuh. Client tidak berubah, sehingga pemeriksaan client tidak diulang.
- Audit dependency tidak diulang karena dependency/lockfile tidak berubah; temuan
  audit dev sebelumnya tetap tercatat pada riwayat Phase 02.
- Refactor yang disetujui selesai. Worker dan integrasi layanan lain memerlukan
  fase tersendiri; tidak memulai tugas berikutnya secara otomatis.

## Historical record — Phase 02 (2026-11-03)

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

## Frontend Tailwind + shadcn UI refactor
- Status: implementasi frontend selesai; tidak ada commit.
- Struktur `client/src` dipisah menjadi `features/auth`, `features/dashboard`,
  `features/leave`, `features/shared`, `components/ui`, `lib`, dan `styles`.
  `App.tsx` kini menjadi komposisi sesi/login/dashboard; API client pindah ke
  `lib/api.ts`, komponen bersama ke `components/primitives.tsx`.
- Tailwind CSS v4 dipasang dengan plugin resmi Vite `@tailwindcss/vite`.
  `components.json`, alias `@/`, helper `cn` dan komponen Button berbasis
  `class-variance-authority` menyiapkan pola komponen shadcn yang dapat disalin
  dan dimodifikasi di dalam repo. Alur login, parent, dan teacher tetap memakai
  komponen fiturnya yang sudah ada.
- Tidak ada model/data atau fitur produk baru; tidak memasang fitur Tailwind
  tambahan selain animasi shadcn. Prisma/Auth backend/integrasi lain tidak disentuh.
- Pemeriksaan:
  - client `npm run lint`: PASS, tanpa warning.
  - client `npm run build`: PASS, `tsc -b` dan Vite build (29 modul).
  - `curl -i --max-time 3 http://127.0.0.1:3001/api/v1/health`: PASS, HTTP 200,
    `{"status":"ok"}`.
  - Chrome smoke `http://localhost:5173/`: PASS; login heading, email/password
    fields, and submit button rendered in accessibility tree. Vite was already
    running on this port, so a second dev-server start correctly reported EADDRINUSE.
  - `git diff --check`: PASS.
  - Client belum memiliki test runner/unit test; tidak ada test frontend terpisah
    yang dapat dijalankan. Build mencakup typecheck.
  - client `npm audit --omit=dev`: PASS, 0 runtime vulnerabilities. Full install
    audit: 6 temuan (2 low, 4 moderate), termasuk tooling dev; tidak menjalankan
    audit fix otomatis.
- Hambatan setup: perintah `shadcn init` tidak dapat mengakses `ui.shadcn.com`
  (DNS `ENOTFOUND`), sehingga konfigurasi standar dan Button disiapkan manual;
  CLI shadcn disimpan sebagai devDependency untuk penambahan komponen berikutnya.

## Frontend UI polish — 2026-11-04
- Memperbaiki keterbacaan login/dashboard lewat hierarki ukuran teks yang lebih
  jelas, ukuran target interaksi yang lebih nyaman, jarak/kartu yang konsisten,
  serta kontras placeholder yang lebih terbaca.
- Menambahkan indikator fokus keyboard yang konsisten untuk kontrol interaktif.
  Menyempurnakan breakpoint ponsel/tablet untuk ringkasan, form, tabel, panel
  detail, dan login tanpa mengubah alur atau kontrak API.
- Verifikasi aktual di `client/`: `npm run lint` PASS; `npm run build` PASS
  (TypeScript dan Vite, 29 modul); `git diff --check` PASS. Chrome smoke PASS:
  halaman login termuat dan heading, label email/kata sandi, tombol masuk, serta
  catatan akun demo muncul pada accessibility tree.
- Tidak ada test runner frontend yang tersedia; tidak menambah dependency.
  Smoke browser hanya menguji halaman login; alur Parent/Teacher memerlukan akun
  demo dan API/database hidup dan tidak diklaim telah diuji dalam perubahan ini.

## Frontend visual redesign follow-up — 2026-11-04
- Menegaskan hierarki visual login dengan latar hijau bergradasi, ornamen
  lingkaran, panel form putih, dan bantuan yang lebih terbaca.
- Memperjelas dashboard melalui area heading berwarna, tiga kartu ringkasan
  dengan aksen status, dan permukaan daftar/form yang lebih terdefinisi.
- Menghilangkan ruang kanan kosong pada desktop ketika belum ada permintaan
  terpilih; panel detail tetap mendapat ruang saat permintaan dipilih.
- Verifikasi aktual di `client/`: `npm run lint` PASS; `npm run build` PASS
  (`tsc -b` dan Vite, 29 modul). Chrome smoke `http://localhost:5173/` PASS:
  login termuat dan screenshot memperlihatkan panel dan palet baru. Tidak ada
  test runner frontend terpisah. Dashboard berautentikasi belum diverifikasi
  pada iterasi ini.

## Frontend MinIO attachment integration — 2026-11-04
- Form Parent kini menerima lampiran opsional PDF/JPEG/PNG hingga 5 MiB. FE
  membuat pengajuan terlebih dahulu lalu mengunggah field multipart bernama
  `file`; jika upload gagal, pengajuan tetap ditampilkan dan detail menyediakan
  kontrol untuk mencoba upload lagi tanpa mengirim pengajuan duplikat.
- Detail permintaan menampilkan nama, MIME type, ukuran berkas dan tombol unduh
  untuk Parent maupun Teacher yang berhak melihat permintaan. Unduh meminta URL
  bertanda tangan baru dari API setiap kali agar masa berlaku URL 300 detik
  tidak menyebabkan tautan lama dipakai ulang.
- API client sengaja tidak mengatur `Content-Type` untuk `FormData`, sehingga
  browser menyertakan boundary multipart. Batas akses, tipe bytes dan ukuran
  tetap divalidasi oleh server; atribut `accept`/cek ukuran FE hanya membantu
  pengalaman pengguna.
- File berubah: `client/src/lib/api.ts`,
  `client/src/features/leave/CreateRequest.tsx`,
  `client/src/features/leave/RequestDetail.tsx`, `client/src/styles/app.css`.
- Verifikasi aktual: di `client/`, `npm run lint` PASS tanpa warning; `npm run
  build` PASS (TypeScript dan Vite, 29 modul); root `git diff --check` PASS.
  Tidak tersedia test runner di client.
- Smoke test API/MinIO end-to-end belum dijalankan: Docker Compose menunjukkan
  PostgreSQL sehat dan MinIO hidup, tetapi `curl -i --max-time 3
  http://127.0.0.1:3001/api/v1/health` gagal tersambung (API belum berjalan).
  Karena itu alur Parent/Teacher melalui browser dan unduh berkas belum
  diverifikasi terhadap layanan hidup.

## Phase 06 — Redis queue, notifications, and dashboard cache — 2026-11-04
- Menambahkan Redis Compose pada `127.0.0.1:56379` dengan AOF, volume persisten,
  healthcheck, dan `noeviction`; koneksi aplikasi berasal dari `REDIS_URL`.
- Menambahkan migrasi Prisma model `Notification`, enum `NotificationType`,
  FK ke user/pengajuan izin, index daftar per user, dan unique
  `(userId, leaveRequestId, type)` untuk idempotensi.
- Keputusan guru yang committed menginvalidasi cache ringkasan guru lalu
  mengirim job `leave.decided`; retry BullMQ maksimal 5 kali dengan exponential
  backoff mulai 1 detik. Worker dapat dijalankan terpisah lewat
  `cd server && npm run worker:dev` atau, setelah build,
  `npm run worker:prod`.
- `GET /api/v1/notifications` memberi notifikasi sesuai user JWT tanpa `userId`.
  `GET /api/v1/dashboard/summary` hanya untuk Teacher dan menghitung kelas
  tugasnya; cache per guru berlaku 60 detik, dengan fallback baca PostgreSQL
  saat cache gagal.
- File implementasi meliputi `compose.yaml`, `.env.example`, README dan dokumen
  API/arsitektur, package manifest/lock server, schema dan migrasi Prisma,
  provider Redis/cache/queue, modul dashboard/notifikasi, bootstrap worker,
  integrasi keputusan izin, serta test database.
- Verifikasi aktual di `server/`:
  - `npm run lint`: PASS, 0 warning dan 0 error.
  - `npm test`: PASS, 4 file dan 13 test.
  - `npm run test:db`: PASS, 4 file dan 80 test; migrasi test DB sudah terapan.
    Test antrean mengirim job ke Redis riil dan memverifikasi dua kegagalan
    pemrosesan transien lalu selesai pada percobaan ketiga.
  - `npm run build`: PASS; Prisma Client dihasilkan dan Nest build selesai.
  - `git diff --check`: PASS.
- Test retry mensimulasikan error transien pada processor, bukan mematikan proses
  worker secara mendadak. Semantik job retry diuji terhadap Redis/BullMQ yang
  hidup. Tidak ada endpoint mark-as-read pada scope ini.
- Risiko consistency yang diketahui: keputusan PostgreSQL dan enqueue Redis
  bukan satu transaksi. Jika API crash di antara keduanya, pengajuan sudah final
  tetapi notifikasi mungkin tidak dibuat; transactional outbox adalah tindak
  lanjut. Invalidasi cache juga fail-open dan TTL 60 detik membatasi cache basi
  jika operasi delete Redis gagal.
- Tidak ada commit dibuat.

Next: review Phase 06; transactional outbox dan mark-as-read dapat menjadi
pekerjaan berikutnya setelah persetujuan task baru.

## Phase 07 — Integration QA and demo — 2026-11-04
- Menambahkan test PostgreSQL + HTTP untuk satu alur Parent membuat pengajuan,
  Teacher melihat dan menyetujui, Parent membaca status final, serta Parent
  lain menerima 404. Test ini melengkapi kasus otorisasi negatif lain yang sudah
  ada di suite database.
- Menambahkan `server/scripts/qa-smoke.mjs` dan `npm run smoke` tanpa dependency
  tambahan. Smoke test memakai akun seed fiktif, memverifikasi alur melalui API
  hidup, lalu mencatat bahwa satu pengajuan fiktif dibuat di database lokal.
- README kini mendokumentasikan workflow hybrid, akun demo dan keterbatasan
  seed password, perintah smoke, outline demo lima menit, serta batasan proyek.
  ADR 0001 mencatat alasan workflow hybrid, trade-off operasional, readiness vs
  liveness, dan proses triage.
- Verifikasi aktual:
  - `client/npm run lint`: PASS; `client/npm run build`: PASS (TypeScript dan
    Vite, 29 modul).
  - `server/npm run lint`: PASS, 0 warning dan 0 error.
  - `server/npm test`: PASS, 4 file dan 13 test.
  - `server/npm run test:e2e`: awalnya diblokir sandbox (`connect EPERM` ke
    Redis loopback); dijalankan ulang dengan izin akses lokal dan PASS, 1 file
    dan 6 test.
  - `server/npm run test:db`: PASS, 4 file dan 81 test; tiga migrasi sudah
    diterapkan pada database test.
  - `server/npm run build`: PASS (Prisma Client dan Nest build).
  - API lokal dijalankan di port 3001; `server/npm run smoke`: PASS. Parent A
    mengajukan, Teacher menyetujui, Parent A membaca APPROVED, dan Parent B
    menerima 404. Smoke menambahkan satu pengajuan fiktif ke DB demo lokal.
- Keterbatasan verifikasi: workflow yang diuji adalah Docker untuk layanan
  pendukung dan proses aplikasi lokal, bukan full-stack Compose atau checkout
  mesin baru. Tidak ada browser automation/beban. Test e2e perlu akses loopback
  untuk Redis di sandbox ini. Tidak ada dependency baru atau commit.

## Frontend/backend integration follow-up — 2026-11-04
- Menambahkan `GET /students/assigned` untuk Teacher. Filter kelas menggunakan
  `teacherId` dari identitas JWT yang diverifikasi server; field respons terbatas
  pada identitas siswa dan kelas. FE Teacher kini memetakan `studentId` dari
  pengajuan ke nama siswa yang benar.
- FE memanggil `GET /dashboard/summary` untuk statistik Teacher dan
  `GET /notifications` untuk Parent. Ringkasan tetap memakai data daftar izin
  sebagai fallback jika ringkasan tidak tersedia. Panel notifikasi menampilkan
  item dan status kosong; mark-as-read tetap belum ada sesuai implementasi API.
- Token login disimpan di `sessionStorage` untuk bertahan saat reload dalam tab
  yang sama, lalu diverifikasi ulang lewat `GET /auth/me`. Logout atau token
  yang ditolak server menghapus token. Tidak ada refresh token.
- Memperbarui `docs/API.md` agar mendokumentasikan route Teacher dan tidak lagi
  mencantumkan route mark-as-read yang belum diimplementasikan.
- Verifikasi aktual: client lint PASS tanpa warning; client build PASS;
  server lint PASS tanpa warning/error; server unit PASS (4 file, 13 test);
  server e2e PASS (1 file, 6 test); server database PASS (4 file, 82 test);
  server build PASS; `git diff --check` PASS. Percobaan pertama test DB
  mengalami `ENOENT` saat Prisma Client sedang dibuat bersamaan oleh build;
  pengulangan setelah generate selesai PASS.
- Tidak tersedia test runner FE atau browser automation, sehingga tampilan
  interaktif belum diuji otomatis di browser. Notifikasi saat ini hanya dibaca,
  belum dapat ditandai telah dibaca. Token `sessionStorage` dibatasi ke tab dan
  hilang ketika tab ditutup; autentikasi cookie/refresh tidak termasuk fase ini.
- Tidak ada dependency baru atau commit.

## Kebijakan password dan reset akun seed — 2026-11-04
- Batas password pada login API, form FE, dan `SEED_PASSWORD` kini minimal
  8 karakter (maksimum login tetap 256). Nilai kurang dari 8 ditolak sebelum
  seed mengubah database.
- Seed ulang memperbarui hash untuk tiga akun demo mengikuti `.env` terkini.
  Hash tetap memakai salt scrypt acak per akun; seed tidak menghapus pengajuan
  atau record lain. README dan kontrak API diperbarui agar mencerminkan perilaku.
- Verifikasi aktual: client lint PASS; server lint PASS tanpa warning/error;
  server unit test PASS (4 file, 13 test); server database test PASS (4 file,
  84 test); client build PASS; server build PASS. `git diff --check` PASS.
- Seed ulang: percobaan sandbox awal terhalang `EPERM` saat mengakses
  PostgreSQL lokal; setelah izin akses disetujui, `npm run prisma:seed` PASS
  (`1 teacher, 2 parents, 2 classes, 3 students`). Seed memakai nilai
  `SEED_PASSWORD` terkini dari `.env`, tanpa menampilkan kredensial di log.

## Frontend UI/UX refinement — 2026-11-04
- Merapikan stylesheet utama menjadi sistem token warna, tipografi, jarak,
  radius, border, dan bayangan yang konsisten; menata ulang dashboard, formulir,
  tabel, badge, panel detail, notifikasi, serta halaman login.
- Menambahkan layout adaptif untuk desktop, tablet, dan ponsel; tabel tetap dapat
  digulir pada layar sempit. Fokus keyboard terlihat dan animasi mengikuti
  preferensi `prefers-reduced-motion`.
- Menambahkan status memuat, gagal, dan kosong yang dapat dibaca teknologi bantu
  pada daftar/notifikasi; form login dan pengajuan mengumumkan status sibuk.
  Navigasi dashboard diberi label semantik dan indikator halaman aktif.
- Verifikasi aktual: `client/npm run lint` PASS; `client/npm run build` PASS
  (TypeScript dan Vite); `git diff --check` PASS. Client belum memiliki test
  runner atau otomasi browser, jadi interaksi visual belum dites otomatis.
- Tidak ada dependency baru atau perubahan API. Perubahan UI sebelumnya pada
  working tree tetap dipertahankan; tidak ada commit dibuat.

## Follow-up navbar, relasi parent-anak, dan verifikasi queue — 2026-11-04
- Perbaiki seed fiktif: Siswa A milik Parent A; Siswa B dan C milik Parent B.
  Test relasi Prisma diperbarui. Seed lokal dijalankan ulang; hasilnya 1 teacher,
  2 parents, 2 classes, dan 3 students. Seperti perilaku seed saat ini, hash
  password akun demo mengikuti `SEED_PASSWORD` di `.env`.
- Parent hanya menerima siswa dengan `parentId` yang berasal dari identitas
  token (`StudentsService.mine`); endpoint pengajuan mencocokkan juga ID siswa
  dengan parent tersebut. Akar masalah tampilan sebelumnya adalah data seed
  yang memasangkan Siswa B ke Parent A, bukan bypass otorisasi.
- Navbar yang semula disembunyikan pada lebar layar ponsel kini ditampilkan
  sebagai baris navigasi penuh. Font diganti ke system UI yang tersedia lintas
  platform, tanpa menambah dependency font.
- Pemeriksaan layanan: `docker compose ps` menunjukkan PostgreSQL dan Redis
  `healthy`; Redis memakai port lokal 56379. `GET /api/v1/health` merespons
  HTTP 200. Test DB mencakup antrean dan worker BullMQ dengan retry; 84 test
  lulus, termasuk worker menyelesaikan job setelah dua kegagalan sementara.
- Verifikasi: client lint/build PASS; server lint/unit/build PASS; server
  `npm run test:db` PASS (4 file, 84 test); seed lokal PASS; health PASS;
  `git diff --check` PASS. `ps` tidak dapat dijalankan dari sandbox, sehingga
  status worker dev yang persisten di luar test belum diverifikasi. Tidak ada
  dependency baru atau commit.

## Metadata siswa pada notifikasi — 2026-11-04
- `GET /notifications` menyertakan nama siswa dan jenis izin dari relasi leave
  request; tidak ada perubahan skema database dan `userId` tetap tidak diekspos.
- Dropdown notifikasi menampilkan nama siswa serta jenis izin dalam label
  Indonesia. Kontrak API dan test integrasi diperbarui.
- Verifikasi: client lint/build PASS; server lint PASS, `npm run test:db` PASS
  (4 file, 84 test), server build PASS; `git diff --check` PASS.

## Panduan mulai cepat README — 2026-11-04
- Ringkas bagian mulai cepat dengan prasyarat runtime, pembuatan `.env`,
  instalasi dependency, startup layanan Docker, migrasi/seed, dan perintah untuk
  menjalankan API, worker, serta frontend di terminal terpisah.
- Verifikasi: tinjau perintah terhadap `.nvmrc`, `.env.example`, `compose.yaml`,
  dan script npm; `git diff --check` PASS. Tidak menjalankan test karena hanya
  dokumentasi.
