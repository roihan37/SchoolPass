# SchoolPass

Fondasi Phase 00–01: React + TypeScript + Vite di `client/`, NestJS + TypeScript di
`server/`, dan PostgreSQL sebagai satu-satunya service Docker Compose. Phase 01
menambahkan empat model Prisma, migrasi, seed fiktif, dan provider database Nest.

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
tidak menampilkannya. `.env` yang sudah ada dipertahankan; hanya `SEED_PASSWORD`
yang ditambahkan bila belum ada. Memerlukan Python 3.

```sh
python3 - <<'PYENV'
from pathlib import Path
import secrets
p = Path('.env')
if not p.exists():
    p.write_text('POSTGRES_DB=schoolpass\nPOSTGRES_USER=schoolpass\nPOSTGRES_PASSWORD=' + secrets.token_hex(24) + '\n')
text = p.read_text()
if not any(line.startswith('SEED_PASSWORD=') for line in text.splitlines()):
    p.write_text(text.rstrip() + '\nSEED_PASSWORD=' + secrets.token_hex(24) + '\n')
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

GET `/api/v1/students/mine` ditunda sampai autentikasi tersedia sesuai opsi tugas
Phase 01. Belum ada endpoint data siswa, JWT, fitur React baru, MinIO, Redis, BullMQ.

## Hasil dan batasan

Phase 01: lint/build server lulus; 5 unit test, 4 tes HTTP, dan 14 tes PostgreSQL
lulus. Schema valid, migrasi diterapkan, seed berulang tidak menggandakan data,
dan health hasil build HTTP 200. Client tidak berubah; hasil lint/build Phase 00
tetap menjadi hasil historis. Detail perintah dan kegagalan awal
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
[tugas Phase 01](harness/tasks/01-database.md). Phase berikutnya menunggu persetujuan.
