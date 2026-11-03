# SchoolPass

Fondasi Phase 00–03: React + TypeScript + Vite di `client/`, NestJS + TypeScript di
`server/`, dan PostgreSQL sebagai satu-satunya service Docker Compose. Phase 01
menambahkan empat model Prisma, migrasi, seed fiktif, dan provider database Nest.
Phase 02 menambahkan login JWT serta akses anak sesuai role dan kepemilikan.
Phase 03 menambahkan backend pengajuan izin dan keputusan final guru.

## Struktur backend

- `server/src/modules/`: fitur `auth`, `students`, `leave-requests`, dan `health`; controller tipis,
  business logic dan pemeriksaan kepemilikan di service. DTO berada di fitur terkait.
- `server/src/infrastructure/database/`: provider Prisma dan konfigurasi database.
- `server/src/common/`: guard/decorator/identitas bersama dan utility password
  yang juga dipakai seed. Registrasi global guard tetap dimiliki AuthModule.
- `server/src/generated/prisma/`: output generator yang diabaikan Git.
- `server/prisma/`: schema, migrasi, seed, dan persiapan database test.
- Unit test berada dekat komponen; `server/test/` menyimpan tes HTTP/database
  lintas module. Perintah development dan kontrak API tetap sama.

`main.ts` menjalankan API. Worker akan memiliki proses dan entry point tersendiri
pada fase queue; Redis, MinIO, BullMQ, dan worker belum diimplementasikan.
Rincian batas module ada di [dokumen arsitektur](docs/ARCHITECTURE.md).

## Runtime dan versi teruji (3 November 2026)

- macOS arm64; Node.js **24.18.1**, npm **11.16.0**, nvm **0.40.5**.
- Docker **29.7.2**, Docker Compose **5.5.1**, PostgreSQL **17.11**.
- React **19.3.1**, Vite **8.3.5**, TypeScript client **7.0.2**.
- NestJS **12.3.2**, Nest CLI **12.0.11**, TypeScript server **6.0.2**,
  Vitest **4.1.12**. Versi langsung dipin; kedua `package-lock.json` disertakan.
- Prisma CLI/client/adapter PostgreSQL **7.10.1**, driver `pg` **8.23.1**.

## Menjalankan lokal

Jalankan dari root repositori. Jika nvm belum dimuat di shell:

```sh
source "$HOME/.nvm/nvm.sh"
nvm use
node --version
npm --version
```

Instalasi awal telah diuji dengan `npm install` di masing-masing folder. Untuk
mengikuti lockfile, gunakan perintah berikut (juga telah diuji):

```sh
(cd client && npm ci)
(cd server && npm ci)
```

Siapkan `.env` lokal. `.env.example` menunjukkan variabel yang diperlukan dan
sengaja tidak menyimpan password. Perintah berikut membuat password acak lokal,
tidak menampilkannya. `.env` yang sudah ada dipertahankan; `SEED_PASSWORD` dan
`JWT_SECRET` ditambahkan bila variabelnya belum ada. Nilai kosong yang sudah ada
perlu diisi manual. Memerlukan Python 3.

```sh
python3 - <<'PYENV'
from pathlib import Path
import secrets
p = Path('.env')
if not p.exists():
    p.write_text('POSTGRES_DB=schoolpass\nPOSTGRES_USER=schoolpass\nPOSTGRES_PASSWORD=' + secrets.token_hex(24) + '\n')
text = p.read_text()
if not any(line.startswith('SEED_PASSWORD=') for line in text.splitlines()):
    text = text.rstrip() + '\nSEED_PASSWORD=' + secrets.token_hex(24) + '\n'
if not any(line.startswith('JWT_SECRET=') for line in text.splitlines()):
    text = text.rstrip() + '\nJWT_SECRET=' + secrets.token_hex(32) + '\n'
p.write_text(text)
p.chmod(0o600)
PYENV
```

Jalankan Docker Desktop, kemudian database:

```sh
docker desktop start
docker compose config --quiet
docker compose up -d --wait
docker compose ps
docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" && psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();"'
```

Database: `127.0.0.1:55432` menuju port container `5432`. Port host `5432` sudah
digunakan PostgreSQL lokal pada mesin pengujian. Volume `postgres_data` menyimpan
data saat container diganti. Perubahan password pada `.env` tidak otomatis
mengubah password database yang sudah diinisialisasi di volume.

API mengizinkan request browser hanya dari origin frontend lokal
`http://127.0.0.1:5173` dan `http://localhost:5173`; origin lain tidak mendapat
header CORS. Jika port Vite diubah, sesuaikan allowlist di
`server/src/common/http/cors.ts`.

Terminal API:

```sh
cd server
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
PORT=3001 npm run start:dev
```

Terminal frontend:

```sh
cd client
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Buka <http://127.0.0.1:5173>. Port API bawaan 3000 digunakan proses Docker lain
setelah Docker Desktop berjalan, sehingga perintah teruji menggunakan 3001.
Kedua aplikasi hanya bind ke loopback. Compose dan konfigurasi database membaca
`.env` root; server memakai `process.loadEnvFile` bawaan Node. Variabel shell
memiliki prioritas. Jalankan perintah npm server dari `server/`.

URL database dibentuk dari variabel `POSTGRES_*` dengan encoding kredensial yang
sesuai. `DATABASE_URL` dapat menggantikannya. `SEED_PASSWORD` wajib minimal 16
karakter: isi nilai lokal bila masih kosong. Seed menyimpan hash scrypt dengan
salt acak per pengguna; password tidak dicetak. Seed transaksional membuat
1 guru, 2 orang tua, 2 kelas, 3 siswa fiktif, tanpa leave request. Pengulangan
seed memakai ID tetap dan mempertahankan hash password yang sudah tersimpan.

`prisma:deploy` menerapkan migrasi yang sudah tersedia pada checkout baru.
Untuk perubahan schema dalam development, jalankan dari `server/`:

```sh
npm run prisma:format
npm run prisma:validate
npm run prisma:migrate -- --name nama_perubahan
npm run prisma:generate
npm run prisma:status
```

`migrate dev` memerlukan izin membuat shadow database. Jangan memilih reset
bila ada data penting; tinjau drift terlebih dahulu. Tidak ada reset otomatis
dalam script proyek.

## Verifikasi

Dari root, setelah API dan frontend berjalan:

```sh
curl -i -fsS http://127.0.0.1:3001/api/v1/health
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/v1/missing
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:5173/
curl -fsS http://127.0.0.1:5173/src/App.tsx
```

Hasil: health **200** dengan `{"status":"ok"}`; dua route lain **404**.
Health bersifat publik dan hanya memeriksa liveness API, bukan koneksi database.
Frontend diverifikasi lewat respons HTML dan transformasi modul; belum ada tes
browser otomatis atau test runner frontend.

```sh
(cd client && npm run lint && npm run build)
(cd server && npm run lint && npm test && npm run test:e2e && npm run build)
(cd server && npm run test:db && npm run prisma:status)
(cd server && npm audit --omit=dev)
```

Untuk memeriksa hasil build API, hentikan watch mode dengan Ctrl+C terlebih dahulu:

```sh
cd server
PORT=3001 npm run start:prod
```

Perintah ini juga diuji dengan curl health yang sama. Hentikan server lokal dengan
Ctrl+C. Jangan menjalankan `npm ci` ketika watch mode aktif karena `node_modules`
diganti selama instalasi. Untuk menghentikan database tanpa menghapus volume,
tersedia `docker compose stop` (perintah operasional ini belum diuji pada sesi ini).

Verifikasi build Phase 01 memakai `PORT=3011 npm run start:prod` dan curl pada
port 3011 karena 3001 sedang terpakai (`EADDRINUSE`). Bila memilih port lain,
sesuaikan URL curl. Proses pengujian port 3011 sudah dihentikan setelah verifikasi.

`test:db` mengompilasi tool seed/test, membuat database terpisah
`schoolpass_test` bila belum ada, menerapkan migrasi, lalu menjalankan tes nyata
PostgreSQL. Akun lokal perlu izin `CREATE DATABASE`; akun Compose sudah memilikinya.
Override `TEST_DATABASE_URL` harus memakai nama database berbeda dengan akhiran
`_test`. Gunakan database khusus pengujian: seed memperbarui fixture di dalamnya.
Script tidak melakukan drop/reset. Fixture leave sementara dibatalkan melalui
rollback transaksi. Pemeriksaan jumlah data mengharapkan database khusus fixture.

## Arsitektur dan kompatibilitas

Vite menyediakan server development, transformasi TSX, dan bundling client; React
merender UI. `AppModule` Nest mendaftarkan controller dan service. Controller
memetakan GET `/api/v1/health`; dependency injection Nest memasukkan `AppService`
ke constructor controller. Service mengembalikan status. `AppModule` mengimpor
`PrismaModule`, yang menyediakan dan mengekspor `PrismaService` melalui DI.
Service membuat satu Prisma client dengan `PrismaPg`, menghubungkan database saat
module init, dan melepas koneksi saat shutdown. Health tetap liveness; startup
aplikasi memerlukan database karena hook inisialisasi provider.

Client memakai ESM dengan resolusi bundler, server memakai ESM `NodeNext` serta
import relatif `.js` agar hasil kompilasi dapat dijalankan Node langsung.
Keduanya memakai TypeScript strict. TypeScript server mengikuti kebutuhan Nest 12
beserta decorator metadata, terpisah dari versi TypeScript client.

Compose menjalankan container dari image `postgres:17.11-bookworm`. Image adalah
template paket PostgreSQL; container adalah proses terisolasi yang menjalankannya.
Volume menyimpan data terpisah dari siklus hidup container. Port mapping membuka
akses host lokal. Health check `pg_isready` menguji kesiapan menerima koneksi;
query SQL diverifikasi terpisah.

Prisma 7 memakai generator `prisma-client` dengan output `src/generated/prisma`,
format ESM dan import `.js`, sesuai [panduan resmi NestJS Prisma 7](https://www.prisma.io/docs/guides/v7/frameworks/nestjs).
URL datasource dan seed dikonfigurasi dalam `prisma.config.ts`; adapter driver
dibutuhkan saat runtime. Generated client diabaikan Git dan dibuat kembali
melalui `prisma:generate` (otomatis sebelum build/start:dev). Tool seed dikompilasi
dengan TypeScript lalu dijalankan Node, sehingga mengikuti resolusi ESM yang sama.

`User`, `SchoolClass`, `Student`, dan `LeaveRequest` memakai UUID primary key.
Foreign key menjamin referensi ada; `Restrict` mencegah penghapusan relasi yang
masih dipakai. Email dan nama kelas unik; pasangan siswa/tanggal absen juga unik,
sehingga dua permintaan pada tanggal sama ditolak PostgreSQL. Tanggal absen
memakai SQL `DATE`; timestamp memakai `timestamptz`. Indeks mendukung pencarian
orang tua, kelas, guru, serta status/waktu permintaan. Migrasi adalah riwayat SQL
perubahan struktur yang diterapkan ke database, bukan seed data.

Tes database membandingkan query Prisma terfilter `parentId` dengan SQL
`Student JOIN SchoolClass JOIN User`: FK `classId` menghubungkan siswa ke kelas,
FK `teacherId` menghubungkan kelas ke guru, dan `WHERE parentId = $1` membatasi
hasil. Parameter dibind, tanpa merangkai input ke SQL. Ini verifikasi query;
otorisasi tetap perlu autentikasi dan pemeriksaan kepemilikan pada fase berikutnya.
FK sendiri tidak menjamin role orang tua/guru atau identitas pengaju.

Phase 02 menambahkan JWT dan GET `/api/v1/students/mine` dengan filter kepemilikan
berdasarkan identitas terverifikasi. React, MinIO, Redis, dan BullMQ belum ditambahkan.

## Autentikasi lokal — Phase 02

Isi `JWT_SECRET` di `.env` root dengan nilai acak minimal 32 byte. Buat nilainya
sekali dengan perintah berikut, lalu salin hasilnya ke `.env` lokal yang diabaikan Git:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Server menolak startup jika secret kosong/terlalu pendek. Jangan menyalin secret
atau token ke issue, screenshot, maupun file tracked. Rotasi secret membatalkan token
yang ditandatangani secret lama.

```bash
# Dari root, gunakan Node sesuai .nvmrc
nvm use
docker compose up -d postgres
cd server
npm ci
npm run prisma:deploy
npm run prisma:seed
PORT=3001 npm run start:dev
```

Seed memakai email `parent.a@example.test`, `parent.b@example.test`, dan
`teacher@example.test`. Password adalah nilai `SEED_PASSWORD` pada seed pertama;
seed ulang mempertahankan hash lama, sehingga mengganti `.env` tidak mereset password.
Tidak ada registrasi publik. Login mengembalikan `accessToken`, `tokenType: Bearer`,
`expiresIn: 900` detik dan `user` tanpa hash. Login memakai email persis seperti seed.

Untuk memeriksa login dan akses anak tanpa memasukkan password/token ke command history,
jalankan di terminal lain dari `server/`:

```bash
node --input-type=module <<'JS'
import { strict as assert } from 'node:assert';
process.loadEnvFile('../.env');
const base = 'http://127.0.0.1:3001/api/v1';
const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'parent.a@example.test', password: process.env.SEED_PASSWORD }),
});
assert.equal(login.status, 200);
const { accessToken } = await login.json();
for (const path of ['/auth/me', '/students/mine']) {
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log(path, response.status, await response.json());
}
JS
```

Token berlaku 15 menit (HS256, issuer `schoolpass`, audience `schoolpass-api`).
`/health` dan `/auth/login` publik; `/auth/me` memerlukan JWT; `/students/mine`
khusus Parent. Tanpa token/token tidak valid menghasilkan 401; Teacher yang
mengakses anak menghasilkan 403; kredensial berbentuk salah/field tambahan menghasilkan
400. Parameter `parentId` dari klien tidak digunakan untuk memilih pemilik data.
Role dibaca dari database setiap request. Password scrypt memakai salt acak dan
perbandingan hash dengan `timingSafeEqual`, kompatibel dengan seed Phase 01.

Verifikasi dari `server/`:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run test:db
npm run build
npx prettier --check --ignore-path ../.gitignore 'src/**/*.ts' 'test/**/*.ts' 'prisma/**/*.ts' prisma.config.ts 'vitest.config*.ts'
```

Tes DB memakai database terpisah berakhiran `_test`, akun fiktif sementara, dan
secret acak per test run. Tes mencakup login kedua role, validasi DTO, token
rusak/kedaluwarsa, pembatasan role, dan pemisahan anak antar-parent.
Belum ada refresh token, logout/revocation list, atau pembatasan percobaan login;
fitur ini perlu dirancang sebelum penggunaan di luar demo lokal.

## Workflow izin — Phase 03

Jalankan PostgreSQL dan API dengan perintah lokal di atas. Login sebagai Parent
dan Teacher menggunakan panduan Phase 02; simpan JWT masing-masing sebagai
`PARENT_TOKEN` dan `TEACHER_TOKEN` di shell lokal (jangan simpan token di Git).
Isi `STUDENT_ID` dari `/students/mine`. Contoh dengan API pada port 3001:

```bash
curl -i http://127.0.0.1:3001/api/v1/leave-requests \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H 'Content-Type: application/json' \
  --data "{\"studentId\":\"$STUDENT_ID\",\"absenceDate\":\"2026-11-04\",\"type\":\"SICK\",\"reason\":\"Demam fiktif\"}"

curl -fsS http://127.0.0.1:3001/api/v1/leave-requests \
  -H "Authorization: Bearer $TEACHER_TOKEN"

# Isi LEAVE_ID dari respons pengajuan/list.
curl -i -X PATCH "http://127.0.0.1:3001/api/v1/leave-requests/$LEAVE_ID/decision" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"status":"APPROVED"}'

curl -fsS "http://127.0.0.1:3001/api/v1/leave-requests/$LEAVE_ID" \
  -H "Authorization: Bearer $PARENT_TOKEN"
```

Parent hanya dapat mengajukan/melihat permintaannya untuk anak sendiri; guru
hanya kelasnya. Resource di luar akses menghasilkan 404, role salah 403,
validasi 400, JWT tidak valid 401, duplikasi/keputusan ulang 409. Keputusan final
tidak dapat dibalik; penolakan wajib alasan. Detail format tanggal, respons,
dan batas alasan tersedia di [kontrak API](docs/API.md#phase-03--implemented-leave-workflow).
List belum memakai pagination/filter. Tidak ada fitur frontend atau layanan P1.
Perintah verifikasi server tetap seperti bagian sebelumnya; `test:db` juga
menguji HTTP workflow izin dan race create/decision terhadap PostgreSQL `_test`.

## Hasil dan batasan

Phase 03: format, lint (0 warning/error), typecheck aplikasi/tooling, dan build
server lulus; 13 unit test, 4 tes e2e (termasuk health), serta 74 tes database/HTTP
lulus. Tes database mencakup 44 tes workflow izin baru dan kasus konkurensi.
Tidak ada perubahan dependency, schema/migrasi atau client. List belum memakai
pagination; frontend dan layanan P1 belum diimplementasikan pada fase ini.

Riwayat Phase 02: format, lint, type check, build server lulus; 13 unit test, 4 tes HTTP,
dan 30 tes PostgreSQL/HTTP lulus. Login akun seed lama dan health hasil build HTTP
200 terverifikasi; kasus 401/403 juga lulus. Client tidak berubah; lint/build
client diulang dan lulus. Tidak ada perubahan schema/migrasi. Detail perintah dan kegagalan awal
tersimpan di [harness/progress.md](harness/progress.md).

Audit runtime server dan audit client: 0 temuan. Audit penuh server masih keluar
dengan status gagal: **2 moderate** pada Nest CLI/minimatch
([advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)). Saran otomatis npm
menurunkan major Nest CLI ke 11; tidak dijalankan. Perbaikan upstream/tooling perlu
ditinjau sebelum menggunakan scaffold dengan input glob yang tidak tepercaya.
npm juga memperingatkan script `fsevents`, `prisma` dan `@prisma/engines` belum
diizinkan. Generate/migrate/seed/build/test tetap berhasil pada lingkungan ini;
unduhan engine pertama memerlukan akses jaringan.

Panduan proyek: [AGENTS.md](AGENTS.md), [arsitektur](docs/ARCHITECTURE.md), dan
[tugas Phase 03](harness/tasks/03-leave-backend.md). Phase berikutnya menunggu persetujuan.
