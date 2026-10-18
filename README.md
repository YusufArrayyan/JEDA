# JEDA v1.0

Aplikasi web progresif (PWA) untuk latihan literasi verifikasi, dibangun dari `PRD_JEDA_v1.0.docx`. Peserta berlatih empat tahap (**J**elajah Sumber, **E**valuasi Bukti, **D**eteksi Manipulasi, **A**mbil Sikap), menjawab tiga pertanyaan di **Tombol JEDA** sebelum berbagi, lalu menyimpan **Jejak Verifikasi**. JEDA tidak pernah memberi vonis benar atau salah.

## Menjalankan

### Docker (satu perintah)

```bash
docker compose up --build
```

Buka http://localhost:8000. Basis data PostgreSQL 16; data contoh dimuat otomatis saat basis data masih kosong.

### Render (Blueprint)

`render.yaml` membuat satu web service (Docker) dan satu PostgreSQL di region Singapura.

1. Dashboard Render → **New** → **Blueprint** → pilih repo ini.
2. Isi `JEDA_ADMIN_PASSWORD`, `JEDA_FASILITATOR_PASSWORD`, `JEDA_PEMERIKSA_PASSWORD` saat diminta. Bila dibiarkan kosong, kata sandi acak dibuat dan dicatat sekali di log layanan.
3. Klik **Apply**. Build pertama sekitar 5–10 menit. Setelah hidup, masuk sebagai tim lewat **Masuk sebagai tim program**, lalu ganti kata sandi di halaman **Akun**.

Dua mode isi awal, dipilih lewat variabel lingkungan sebelum basis data pertama kali dibuat:

| | Demo (bawaan `render.yaml`) | Pilot sungguhan |
|---|---|---|
| Variabel | `JEDA_MODE_UJI=1`, `JEDA_SEED_DEMO=1` | `JEDA_MODE_UJI=0`, `JEDA_SEED_DEMO=0` |
| Akun tim | admin, Sari, Dimas, Pak Hendra | admin, Sari, Pak Hendra |
| Ruang dan peserta | 3 ruang contoh, Rafi (`RAFI-2026`), 37 peserta sintetis | Tidak ada; fasilitator membuat ruang dari **Kelola ruang** |
| Bank kasus | 12 kasus | 12 kasus |

Kode pribadi Rafi tercantum di README ini, jadi **jangan pakai mode demo untuk data peserta sungguhan**. Untuk beralih dari demo ke pilot, buat basis data baru (Render: hapus lalu buat ulang database `jeda-db`).

Catatan paket gratis Render: layanan tidur setelah 15 menit tanpa akses (bangun sekitar 1 menit), dan PostgreSQL gratis kedaluwarsa setelah 30 hari. Untuk pilot delapan minggu, naikkan ke paket berbayar.

### Pengembangan lokal

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt   # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Frontend (Node 20+), di terminal lain:

```bash
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173. Vite meneruskan `/api` ke port 8000 (ubah dengan `JEDA_API_PORT`). Tanpa `DATABASE_URL`, backend memakai SQLite di `backend/var/`.

### Akun awal (hanya pengembangan lokal)

| Peran | Masuk dengan | Rahasia |
|---|---|---|
| Peserta (Rafi, Ruang JEDA 07) | Kode pribadi | `RAFI-2026` |
| Peserta baru | Kode ruang `JD-07-BKL` + nama samaran | – |
| Fasilitator (Sari, ruang 07 dan pembanding 03) | sari@jeda.local | jeda-fasilitator-2026 |
| Fasilitator (Dimas, ruang 12, empat peserta) | dimas@jeda.local | jeda-fasilitator-2026 |
| Pemeriksa fakta (Pak Hendra) | hendra@jeda.local | jeda-pemeriksa-2026 |
| Admin program | admin@jeda.local | jeda-admin-2026 |

Saat `JEDA_COOKIE_SECURE=1` (HTTPS), kata sandi di atas tidak dipakai; isi lewat variabel lingkungan atau ambil dari log. Akun tim mengganti kata sandinya di halaman **Akun**; admin dapat mengatur ulang kata sandi akun tim lain di **Admin → Akun tim**.

## Data contoh

- **12 kasus lokal Bengkulu** berstatus Terbit, semuanya bertanda SIMULASI. Nama bank, perusahaan, operator, dan kanal cek fakta di dalamnya **rekaan** agar tidak menyerupai lembaga nyata. Ganti atau validasi ulang dengan pemeriksa fakta mitra sebelum pilot (kriteria rilis 5).
- **Dua perangkat soal setara (A/B)**, masing-masing 8 butir: 2 benar, 2 keliru, 2 menyesatkan, 2 sintetis.
- **Peserta sintetis** (benih acak 2026): 24 di ruang 07, 4 di ruang 12 (untuk memperagakan aturan k < 5), dan 9 di ruang pembanding 03. Angka dasbor dari data ini hanya ilustrasi, dan dasbor menyatakannya (FR-7.6).

## Pengujian

```bash
cd backend && .venv/Scripts/python -m pytest -q     # 17 uji penerimaan API (SQLite)
cd frontend && node e2e/smoke.mjs                   # 31 pemeriksaan ujung ke ujung (Edge headless; API dan Vite harus hidup)
```

Untuk menjalankan uji yang sama di PostgreSQL kosong, setel `JEDA_TEST_DATABASE_URL=postgres://user@host:port/db` sebelum `pytest`.

Uji API mencakup: kode ruang salah tidak membocorkan keberadaan kode, persetujuan wajib sebelum tes, fasilitator dan admin tidak bisa membaca jejak peserta, ruang empat orang ditutup, CSV dan ekspor tanpa nama atau teks bebas, telaah dua tahap dengan riwayat, ruang pembanding tidak melihat latihan, kasus ditarik hilang dari latihan, konflik luring diselesaikan dengan waktu terbaru, dan penghapusan data pribadi.

Uji ujung ke ujung menjalankan alur peserta di layar 390 px (masuk, persetujuan, tes awal, latihan empat tahap, Tombol JEDA, jejak, Cek JEDA, bank kasus, studio kartu), latihan dalam **mode pesawat** beserta sinkronisasinya, lalu dasbor, kelola ruang, telaah, admin, dan kelola kasus di layar 1280 px. Tangkapan layar tersimpan di `frontend/e2e/shots/`.

## Struktur

```
backend/app/content.py      teknik, tema, opsi Tombol JEDA, 12 kasus, soal tes A/B, butir SUS
backend/app/logic.py        skor tahap, kelengkapan jejak, skor tes dan SUS (fungsi murni)
backend/app/agregat.py      K1–K3, P1–P5, rekap mingguan; k < 5 ditutup
backend/app/api_peserta.py  M1 akun & ruang, M2 latihan, M3 cek, M4 jejak, M6 tes
backend/app/api_konten.py   M5 bank kasus, studio kartu, telaah dua tahap, kelola kasus, PDF A5
backend/app/api_staf.py     M1 kelola ruang, M7 dasbor & CSV, M8 rekap luring, M9 admin
backend/app/bootstrap.py    pembuatan tabel, data contoh, hapus data pengguna, tugas retensi
frontend/public/sw.js       service worker mode luring
frontend/src/lib/offline.ts antrean tulis luring, simpanan kasus, sesi latihan di perangkat
frontend/src/pages/         layar peserta; pages/staf/ layar fasilitator, pemeriksa, admin
```

## Rancangan UI

Mengikuti PRD 10.1: kerangka DESIGN.md Notion (kanvas putih, tinta arang hangat, garis halus, blok pastel per tahap: langit, mint, persik, lavender). Aksen ungu prototipe diganti biru → hijau toska dari logo JEDA (`#1F56D0`, kontras 6,2:1 di atas putih). Kartu sapaan Beranda memakai latar navy bergradien. Huruf Inter dipaket lokal, tanpa Google Fonts, karena PRD melarang layanan pihak ketiga. Kode diaudit terhadap Vercel Web Interface Guidelines; target sentuh minimal 44 px, fokus terlihat, label selalu tampak, dan gerak dikurangi saat diminta.

## Penyimpangan dan tambahan terhadap PRD

| PRD | Versi ini | Alasan |
|---|---|---|
| Tombol JEDA: tiga pertanyaan + satu tindakan | Ditambah satu skala niat 1–5 sebelum tindakan | Bab 8 meminta niat berbagi tercatat untuk analisis K2; skala eksplisit lebih jujur daripada menurunkan niat dari tindakan |
| Lima teknik manipulasi (FR-2.4) | Ditambah "Potongan konteks" lewat daftar teknik yang dikelola admin (FR-9.4) | Panduan Cek PRD 6 menyebut potongan konteks; dua kasus memakainya |
| FR-5.5 notifikasi surel (S) | Hanya notifikasi dalam aplikasi | Pengiriman surel butuh layanan luar yang belum ditetapkan (PRD 16) |
| FR-1.5 penghapusan maks. 7 hari | Langsung saat diminta | Lebih cepat dari batas; skor tes dilepas dari identitas agar agregat tetap |
| Masuk kembali peserta | Kode pribadi 8 karakter, ditampilkan sekali | PRD tidak mewajibkan kata sandi; nama samaran saja tidak unik |
| Tugas agregasi harian | Agregat dihitung saat dasbor dibuka | Data pilot kecil; tugas harian yang ada dipakai untuk retensi dan pembersihan sesi |
| Antrean telaah fasilitator | Fasilitator hanya melihat usulan dari ruangnya | Selaras dengan prinsip akses minimum Bab 11 |

## Yang belum dan perlu diperiksa sebelum pilot

- Kasus dan soal tes perlu divalidasi pemeriksa fakta mitra; isinya kini rancangan penyusun.
- Uji API (17) dan uji ujung ke ujung (31) sudah lulus di PostgreSQL 18 dengan build produksi, service worker aktif, dan cookie Secure. `Dockerfile` sendiri belum dibangun di mesin ini (Docker Desktop tidak menyala); build pertama di Render menjadi uji image-nya.
- Uji mode pesawat dijalankan di Edge (Chromium) desktop; uji di Android dan Safari iOS nyata (NFR-4, NFR-6) belum dilakukan.
- Audit WCAG dengan pembaca layar dan Lighthouse (NFR-1, NFR-5) belum dijalankan.
- Konsultasi hukum UU PDP, telaah etik, dan prosedur insiden (Bab 11) berada di luar kode.
