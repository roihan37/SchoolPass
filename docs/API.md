# REST API Contract

Prefix: `/api/v1`. Require JWT except login and public liveness `/health`. Phase 00 health checks the API process only, not database readiness.

| Method | Path | Actor | Purpose |
|---|---|---|---|
| GET | /health | Public | Liveness: 200 with `{ "status": "ok" }` |
| POST | /auth/login | Public | Authenticate email/password, issue JWT |
| GET | /auth/me | Auth | Identity and role |
| GET | /students/mine | Parent | Own children only |
| GET | /students/assigned | Teacher | Students in own assigned classes |
| POST | /leave-requests | Parent | One-day request, status=PENDING |
| GET | /leave-requests | Parent/Teacher | Filter by ownership/class |
| GET | /leave-requests/:id | Parent/Teacher | Authorized detail |
| PATCH | /leave-requests/:id/decision | Teacher | APPROVED/REJECTED (once) |
| POST | /leave-requests/:id/attachment | Parent | Upload optional file while pending |
| GET | /leave-requests/:id/attachment-url | Parent/Teacher | Authorized signed download |
| GET | /dashboard/summary | Teacher | Own class counts, Redis cache TTL 60 sec |
| GET | /notifications | Auth | Own in-app notifications |

Expected errors: validation 400; authentication 401; forbidden 403; not found 404; duplicate/decided 409. Be consistent and document deliberate decisions to avoid revealing existence of unauthorized data.

Example request: POST /leave-requests JSON `{ "studentId": "<uuid>", "absenceDate": "2026-11-04", "type": "SICK", "reason": "Demam" }`.
Example decision: PATCH /leave-requests/:id/decision JSON `{ "status": "REJECTED", "decisionReason": "Lampiran perlu diperbarui" }`.

## Phase 02 — implemented authentication contract

- `POST /auth/login`: JSON `{ "email": "parent.a@example.test", "password": "<local seeded password>" }`.
  Email valid, maksimal 254 karakter; password string 8–256 karakter; field tambahan
  ditolak 400. Email dicocokkan persis dengan email yang tersimpan, tanpa normalisasi.
  Berhasil 200: `{ "accessToken": "<JWT>", "tokenType": "Bearer", "expiresIn": 900,
  "user": { "id": "<uuid>", "name": "<fictional name>", "email": "<email>", "role": "PARENT" } }`.
  Password salah maupun email tidak ditemukan mengembalikan pesan 401 yang sama.
- `GET /auth/me`: header `Authorization: Bearer <JWT>`; 200 berisi objek `user`
  seperti di atas tanpa wrapper, tanpa password/hash. User yang sudah dihapus => 401.
- `GET /students/mine`: Parent saja; 200 array `{ id, name, classId, schoolClass: { id, name } }`,
  urutan `id` ascending; tanpa anak => `[]`. Filter `parentId` selalu dari identitas
  terverifikasi server. Query parameter tidak dapat mengganti pemilik data. Teacher => 403.
- `GET /students/assigned`: Teacher saja; bentuk respons sama dengan `/students/mine`,
  tetapi hanya memuat siswa dari kelas yang ditugaskan kepada guru terautentikasi.
  Parent => 403.
- Semua route yang diimplementasikan dilindungi guard secara default kecuali health/login.
  JWT diperiksa signature HS256, expiry wajib, issuer `schoolpass`, audience
  `schoolpass-api`, dan UUID subject. Masa berlaku 900 detik. Role terbaru dibaca dari
  database, bukan dipercaya dari klaim role token. JWT hilang/tidak valid => 401.
- Tidak ada registrasi, refresh token, atau endpoint logout pada fase ini.
  Workflow pengajuan izin, lampiran, dashboard cache, dan in-app notifications
  sudah diimplementasikan.

## Phase 03 — implemented leave workflow

- `POST /leave-requests`: Parent saja; body sesuai contoh di atas, tanpa field
  tambahan. `studentId` harus UUID; `absenceDate` tanggal kalender valid dalam
  format `YYYY-MM-DD` (tahun 0001–9999, tanpa waktu/zona waktu); `type` hanya
  SICK/PERMISSION. `reason` string berisi karakter non-whitespace, maksimal
  2000 karakter; spasi awal/akhir dipangkas saat disimpan. Belum ada pembatasan
  tanggal lampau/mendatang. Berhasil 201, status awal PENDING.
- `GET /leave-requests`: 200 array, urutan `createdAt` descending lalu `id`
  ascending. Parent hanya melihat permintaan yang ia ajukan untuk anak yang
  masih dimilikinya; Teacher hanya kelas yang ditugaskan kepadanya. Tanpa data
  menghasilkan `[]`. Belum ada pagination/filter; query parameter tidak dapat
  mengganti identitas atau memperluas akses.
- `GET /leave-requests/:id`: 200 dengan satu objek, menggunakan batas akses yang
  sama dengan list. Parameter `id` harus UUID, selain itu 400.
- Objek respons berisi field scalar LeaveRequest: `id`, `studentId`,
  `submittedById`, `absenceDate` (YYYY-MM-DD), `type`, `reason`, `status`,
  `reviewedById`, `decisionReason`, `reviewedAt`, `createdAt`. Dua field waktu
  menggunakan ISO UTC; ketiga field review bernilai null sebelum diputuskan.
  Tidak menyertakan objek User, email, hash, atau token.
- `PATCH /leave-requests/:id/decision`: Teacher saja; `status` wajib APPROVED
  atau REJECTED. REJECTED wajib `decisionReason`; APPROVED boleh tanpa alasan.
  Jika dikirim, alasan harus string non-whitespace maksimal 2000 karakter,
  bukan null; spasi awal/akhir dipangkas. Field tambahan ditolak. Berhasil 200
  dengan objek final, reviewer dari identitas server dan waktu review dari server.
- JWT hilang/tidak valid => 401; role salah => 403. Student/request yang tidak
  ada maupun di luar kepemilikan/kelas => 404 dengan pesan yang sama untuk
  masing-masing jenis resource, agar tidak mengungkap keberadaan data.
- Constraint UNIQUE(studentId, absenceDate) menghasilkan 409 untuk duplikasi,
  termasuk create bersamaan atau setelah request final. Keputusan final memakai
  conditional update `status = PENDING`; keputusan ulang/konkuren yang kalah
  menghasilkan 409. Transaksi menjaga update dan pembacaan hasil bersama;
  transaksi saja tanpa conditional update tidak cukup mencegah overwrite.

Implementasi mempertahankan Prisma 7.10.1 dan mengikuti referensi resmi
[Prisma Client v7](https://www.prisma.io/docs/orm/v7/reference/prisma-client-reference)
untuk updateMany dan P2002, serta
[ValidationPipe NestJS](https://docs.nestjs.com/techniques/validation).

## Phase 06 — notifications and dashboard summary

- `GET /notifications`: Parent/Teacher dengan JWT; hanya baris milik user dari
  identitas terverifikasi, terbaru dahulu. Respons berupa array objek
  `{ id, leaveRequestId, type, message, studentName, leaveType, readAt,
  createdAt }`; nama siswa dan jenis izin diambil dari permintaan terkait,
  sedangkan `userId` tidak diekspos. Read status tersedia di data tetapi belum
  ada endpoint untuk menandai sudah dibaca.
- Keputusan izin yang sudah tersimpan mengirim job `leave.decided` ke BullMQ.
  Worker menulis notifikasi ke PostgreSQL; retry maksimal 5 percobaan dengan
  exponential backoff awal 1 detik. Unique `(userId, leaveRequestId, type)` dan
  upsert menjaga pemrosesan ulang tetap idempotent.
- `GET /dashboard/summary`: Teacher saja; merangkum total/pending/approved/
  rejected per kelas yang ditugaskan serta total gabungan. Cache Redis per ID
  guru berlaku 60 detik, diinvalidasi setelah keputusan berhasil tersimpan.
  Jika Redis cache gagal, ringkasan tetap dibaca dari PostgreSQL.
- Commit keputusan PostgreSQL dan enqueue Redis belum atomik. Jika proses gagal
  di antara keduanya, keputusan tetap tersimpan tanpa job; transactional outbox
  menjadi perbaikan lanjutan.

## Phase 05 — implemented private attachments

- `POST /leave-requests/:id/attachment`: Parent saja, multipart field bernama
  `file`, maksimal 5 MiB dan satu file. Hanya PDF, JPEG, PNG yang MIME type dan
  magic bytes awalnya cocok diterima. Request harus milik Parent dan masih
  PENDING; satu attachment per request. Berhasil 201 dengan metadata tanpa
  object key atau byte berkas.
- `GET /leave-requests/:id/attachment-url`: Parent pemilik atau Teacher yang
  ditugaskan pada kelas request. Menghasilkan metadata dan presigned GET URL
  berumur 300 detik; selain pemilik/kelas mendapat 404. Pengajuan tanpa lampiran
  juga 404.
- Metadata disimpan di PostgreSQL; bytes disimpan di bucket MinIO privat. Object
  key dibuat server dengan UUID. Bila insert metadata gagal sesudah upload,
  server mencoba menghapus object sebagai kompensasi.
- Untuk browser, URL bertanda tangan menuju MinIO langsung; konfigurasi CORS
  MinIO perlu mengizinkan origin frontend jika browser akan membuka URL itu.
  Demo backend dapat mengambil URL dengan `curl`.

SDK memakai AWS SDK for JavaScript v3 yang kompatibel dengan S3, termasuk
[presigner package resmi](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/).
