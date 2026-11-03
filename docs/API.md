# REST API Contract

Prefix: `/api/v1`. Require JWT except login and public liveness `/health`. Phase 00 health checks the API process only, not database readiness.

| Method | Path | Actor | Purpose |
|---|---|---|---|
| GET | /health | Public | Liveness: 200 with `{ "status": "ok" }` |
| POST | /auth/login | Public | Authenticate email/password, issue JWT |
| GET | /auth/me | Auth | Identity and role |
| GET | /students/mine | Parent | Own children only |
| POST | /leave-requests | Parent | One-day request, status=PENDING |
| GET | /leave-requests | Parent/Teacher | Filter by ownership/class |
| GET | /leave-requests/:id | Parent/Teacher | Authorized detail |
| PATCH | /leave-requests/:id/decision | Teacher | APPROVED/REJECTED (once) |
| POST | /leave-requests/:id/attachment | Parent | Upload optional file while pending (P1) |
| GET | /leave-requests/:id/attachment-url | Parent/Teacher | Authorized signed download (P1) |
| GET | /dashboard/summary | Teacher | Own class counts, cached (P1) |
| GET | /notifications | Auth | Own notifications (P1) |
| PATCH | /notifications/:id/read | Auth | Mark own notification read (P1) |

Expected errors: validation 400; authentication 401; forbidden 403; not found 404; duplicate/decided 409. Be consistent and document deliberate decisions to avoid revealing existence of unauthorized data.

Example request: POST /leave-requests JSON `{ "studentId": "<uuid>", "absenceDate": "2026-11-04", "type": "SICK", "reason": "Demam" }`.
Example decision: PATCH /leave-requests/:id/decision JSON `{ "status": "REJECTED", "decisionReason": "Lampiran perlu diperbarui" }`.

## Phase 02 — implemented authentication contract

- `POST /auth/login`: JSON `{ "email": "parent.a@example.test", "password": "<local seeded password>" }`.
  Email valid, maksimal 254 karakter; password string 1–256 karakter; field tambahan
  ditolak 400. Email dicocokkan persis dengan email yang tersimpan, tanpa normalisasi.
  Berhasil 200: `{ "accessToken": "<JWT>", "tokenType": "Bearer", "expiresIn": 900,
  "user": { "id": "<uuid>", "name": "<fictional name>", "email": "<email>", "role": "PARENT" } }`.
  Password salah maupun email tidak ditemukan mengembalikan pesan 401 yang sama.
- `GET /auth/me`: header `Authorization: Bearer <JWT>`; 200 berisi objek `user`
  seperti di atas tanpa wrapper, tanpa password/hash. User yang sudah dihapus => 401.
- `GET /students/mine`: Parent saja; 200 array `{ id, name, classId, schoolClass: { id, name } }`,
  urutan `id` ascending; tanpa anak => `[]`. Filter `parentId` selalu dari identitas
  terverifikasi server. Query parameter tidak dapat mengganti pemilik data. Teacher => 403.
- Semua route yang diimplementasikan dilindungi guard secara default kecuali health/login.
  JWT diperiksa signature HS256, expiry wajib, issuer `schoolpass`, audience
  `schoolpass-api`, dan UUID subject. Masa berlaku 900 detik. Role terbaru dibaca dari
  database, bukan dipercaya dari klaim role token. JWT hilang/tidak valid => 401.
- Tidak ada registrasi, refresh token, atau endpoint logout pada fase ini.
  Endpoint leave request dan seluruh endpoint P1 pada tabel belum diimplementasikan.
