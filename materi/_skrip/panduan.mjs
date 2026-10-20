// Panduan penggunaan visual JEDA (A4) -> materi/panduan/Panduan-Penggunaan-JEDA.pdf
//   node materi/_skrip/panduan.mjs
import { chromium } from "../../frontend/node_modules/playwright-core/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const akar = (p) => fileURLToPath(new URL(p, import.meta.url));
const url = (p) => pathToFileURL(akar(p)).href;
const OUT = akar("../panduan/");
mkdirSync(OUT, { recursive: true });
const FONT = url("../../frontend/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const LOGO = url("../_kerja/logo-crop.png");
const HP = (n) => url(`../mockup/satuan/${n}.png`);
const LY = (n) => url(`../_kerja/layar/${n}.png`);

const css = `
@font-face { font-family: Inter; src: url(${FONT}) format("woff2"); font-weight: 100 900; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, sans-serif; color: #1a1a1a; font-size: 10pt; line-height: 1.5; -webkit-font-smoothing: antialiased; }
.hal { width: 210mm; height: 297mm; padding: 18mm 18mm 16mm; position: relative; page-break-after: always; overflow: hidden; display: flex; flex-direction: column; }
.hal:last-child { page-break-after: auto; }
.kaki { position: absolute; left: 18mm; right: 18mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #8a877f; }
.bagian { font-size: 8pt; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; color: #12357f; }
h1 { font-size: 22pt; line-height: 1.15; letter-spacing: -.02em; font-weight: 720; margin-top: 3mm; }
h2 { font-size: 12pt; font-weight: 680; letter-spacing: -.01em; margin: 7mm 0 2.5mm; }
.lead { font-size: 10.5pt; color: #4a4843; margin-top: 3mm; max-width: 150mm; }
p + p { margin-top: 2mm; }
.muted { color: #5d5b54; }
.kecil { font-size: 8.5pt; }
.baris { display: flex; gap: 6mm; margin-top: 7mm; align-items: flex-start; }
.hp { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
.hp img { width: 62mm; max-width: none; display: block; margin: 0 -5mm -3mm; }
.langkah { margin-top: 2mm; width: 100%; }
.langkah li { list-style: none; display: grid; grid-template-columns: 6mm 1fr; gap: 1.5mm; font-size: 9pt; line-height: 1.45; margin-top: 1.6mm; }
.langkah li b.n { width: 5mm; height: 5mm; border-radius: 50%; background: #12357f; color: #fff; font-size: 7.5pt; display: grid; place-items: center; margin-top: .4mm; }
.judul-hp { font-weight: 650; font-size: 10pt; margin-top: 1mm; }
.cip { display: inline-flex; align-items: center; gap: 1.6mm; font-size: 8pt; font-weight: 620; padding: .8mm 2.6mm .8mm .9mm; border-radius: 99px; color: #37352f; background: #e5e3df; }
.cip i { font-style: normal; width: 4.6mm; height: 4.6mm; border-radius: 1.2mm; background: #fff; display: grid; place-items: center; font-weight: 750; font-size: 7.5pt; }
table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin-top: 3mm; }
th { text-align: left; font-size: 7.5pt; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: #6f6d66; padding: 2mm 2.5mm; border-bottom: 1px solid #c8c4be; }
td { padding: 2.4mm 2.5mm; border-bottom: 1px solid #e5e3df; vertical-align: top; }
td code, .kode { font-family: Consolas, ui-monospace, monospace; font-size: 9pt; background: #f3f1ee; padding: .3mm 1.4mm; border-radius: 1mm; white-space: nowrap; }
.kotak { border: 1px solid #e5e3df; border-radius: 3mm; padding: 4mm 5mm; margin-top: 4mm; }
.kotak.warn { background: #fff4ea; border-color: #f3d3b3; }
.kotak.brand { background: #eef3fd; border-color: #cbd9f6; }
.kotak b { font-weight: 650; }
.layar { border-radius: 2.5mm; overflow: hidden; box-shadow: 0 0 0 .3mm rgba(0,0,0,.1), 0 3mm 6mm -3mm rgba(15,25,50,.25); }
.layar .bar { height: 5mm; background: #ecebe8; display: flex; align-items: center; gap: 1.2mm; padding: 0 2.5mm; border-bottom: 1px solid #dcdad5; }
.layar .bar i { width: 1.6mm; height: 1.6mm; border-radius: 50%; background: #d0cdc7; }
.layar img { display: block; width: 100%; }
.dua { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.tahap { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 4mm; }
.tahap div { border-radius: 2.5mm; padding: 3mm; font-size: 8.5pt; line-height: 1.4; }
.tahap b { display: block; font-size: 9.5pt; margin-bottom: .8mm; }
`;

const kaki = (n) => `<div class="kaki"><span>Panduan penggunaan JEDA · versi 1.0 · Oktober 2026</span><span>${n}</span></div>`;
const hp = (img, judul, langkah, mulai = 1) =>
  `<div class="hp"><img src="${HP(img)}"><div class="judul-hp">${judul}</div><ol class="langkah">${langkah
    .map((l, i) => `<li><b class="n">${mulai + i}</b><span>${l}</span></li>`)
    .join("")}</ol></div>`;
const layar = (img, tinggi) => `<div class="layar"><div class="bar"><i></i><i></i><i></i></div><img src="${LY(img)}" ${tinggi ? `style="height:${tinggi};object-fit:cover;object-position:top"` : ""}></div>`;
const cip = (h, warna, label) => `<span class="cip" style="background:${warna}"><i>${h}</i>${label}</span>`;

const halaman = [];

// 1. Sampul
halaman.push(`<section class="hal" style="padding-top:22mm">
  <div style="display:flex;align-items:center;gap:4mm"><img src="${LOGO}" style="width:15mm"><span style="font-weight:760;font-size:20pt;letter-spacing:.02em;color:#12357f">JEDA</span></div>
  <h1 style="font-size:32pt;margin-top:16mm">Panduan penggunaan</h1>
  <p class="lead" style="font-size:12.5pt;max-width:140mm">Latihan sepuluh menit untuk memeriksa informasi sebelum dibagikan, dengan kasus lokal dari Kota Bengkulu. Panduan ini untuk peserta, fasilitator, pemeriksa fakta, dan admin program.</p>
  <div style="flex:1;display:flex;align-items:center;margin:8mm -6mm 0"><img src="${url("../mockup/01-mockup-utama.png")}" style="width:100%;border-radius:4mm"></div>
  <div style="display:flex;gap:10mm;font-size:9pt;margin-top:6mm">
    <div><div class="muted kecil">Alamat</div><b style="font-size:11pt">jeda.onrender.com</b></div>
    <div><div class="muted kecil">Kode ruang demo</div><b class="kode" style="font-size:11pt">JD-07-BKL</b></div>
    <div><div class="muted kecil">Versi</div><b style="font-size:11pt">1.0 · Oktober 2026</b></div>
  </div>
</section>`);

// 2. Sebelum mulai + akun demo
halaman.push(`<section class="hal">
  <span class="bagian">Sebelum mulai</span>
  <h1>Akses dan akun demo</h1>
  <p class="lead">JEDA berjalan di peramban ponsel atau laptop, tanpa perlu mengunduh aplikasi. Buka <b>jeda.onrender.com</b>. Di ponsel, pilih <i>Tambahkan ke layar utama</i> dari menu peramban agar JEDA terbuka seperti aplikasi.</p>
  <div class="tahap">
    <div style="background:#dcecfa"><b>J · Jelajah Sumber</b>Cari tahu siapa yang pertama kali menyebarkan klaim.</div>
    <div style="background:#d9f3e1"><b>E · Evaluasi Bukti</b>Bandingkan dengan sumber primer dan pembanding independen.</div>
    <div style="background:#ffe8d4"><b>D · Deteksi Manipulasi</b>Kenali teknik yang dipakai pembuat klaim.</div>
    <div style="background:#e6e0f5"><b>A · Ambil Sikap</b>Jawab Tombol JEDA, lalu putuskan sebelum mengirim.</div>
  </div>
  <h2>Akun demo</h2>
  <table>
    <thead><tr><th style="width:30%">Peran</th><th style="width:32%">Tombol di halaman masuk</th><th>Isian</th></tr></thead>
    <tbody>
      <tr><td><b>Peserta baru</b><div class="muted kecil">Ruang JEDA 07</div></td><td>Masuk dengan kode ruang</td><td>Kode ruang <code>JD-07-BKL</code><br>Nama samaran: bebas, misalnya <i>Demo Juri</i></td></tr>
      <tr><td><b>Peserta demo (Rafi)</b><div class="muted kecil">Sudah tercatat di Ruang JEDA 07</div></td><td>Sudah pernah bergabung? Pakai kode pribadi</td><td>Kode pribadi <code>RAFI-2026</code></td></tr>
      <tr><td><b>Fasilitator (Sari)</b><div class="muted kecil">Ruang 07 dan Ruang Pembanding 03</div></td><td>Masuk sebagai tim program</td><td><code>sari@jeda.local</code></td></tr>
      <tr><td><b>Fasilitator (Dimas)</b><div class="muted kecil">Ruang 12, empat peserta</div></td><td>Masuk sebagai tim program</td><td><code>dimas@jeda.local</code></td></tr>
      <tr><td><b>Pemeriksa fakta (Pak Hendra)</b></td><td>Masuk sebagai tim program</td><td><code>hendra@jeda.local</code></td></tr>
      <tr><td><b>Admin program</b></td><td>Masuk sebagai tim program</td><td><code>admin@jeda.local</code></td></tr>
    </tbody>
  </table>
  <p class="kecil muted" style="margin-top:2.5mm">Kata sandi akun tim program di situs daring diatur oleh admin dan diberikan terpisah. Akun Dimas sengaja hanya berisi empat peserta untuk memperlihatkan aturan privasi: kelompok di bawah lima orang tidak ditampilkan di dasbor.</p>
  <div class="kotak warn">
    <b>Situs ini lingkungan uji.</b> Semua kasus rekaan dan bertanda SIMULASI; nama bank, perusahaan, dan kanal cek fakta di dalamnya tidak nyata. Akun demo dipakai bersama, jadi jangan memasukkan nama asli, nomor telepon, atau data pribadi lain.
  </div>
  <div class="kotak">
    <b>Pembukaan pertama bisa lambat.</b> Server paket gratis tidur setelah 15 menit tanpa akses. Bila halaman belum muncul, tunggu sekitar satu menit lalu muat ulang.
  </div>
  ${kaki(2)}
</section>`);

// 3. Masuk pertama kali
halaman.push(`<section class="hal">
  <span class="bagian">Peserta · 1</span>
  <h1>Masuk pertama kali</h1>
  <p class="lead">Peserta tidak perlu mendaftar dengan nama asli atau nomor telepon. Cukup kode ruang dari fasilitator.</p>
  <div class="baris">
    ${hp("16-masuk-terisi", "Halaman masuk", ["Ketik kode ruang, misalnya <code>JD-07-BKL</code>.", "Isi nama samaran. Nama ini yang dilihat fasilitator.", "Surel boleh dikosongkan, lalu ketuk <b>Masuk dengan kode ruang</b>."])}
    ${hp("02-kode-pribadi", "Kode pribadi", ["Catat kode pribadi yang muncul. Kode ini hanya ditampilkan sekali.", "Pakai kode ini untuk masuk lagi dari ponsel lain lewat <b>Pakai kode pribadi</b>."], 4)}
    ${hp("03-persetujuan", "Persetujuan", ["Baca tujuan, data yang dikumpulkan, dan siapa yang melihat.", "Centang kotak usia dan kotak persetujuan, lalu ketuk <b>Setuju dan lanjut</b>."], 6)}
  </div>
  <div class="kotak brand" style="margin-top:auto"><b>Kode pribadi hilang?</b> Kode tidak bisa dipulihkan oleh fasilitator. Masuk lagi dengan kode ruang sebagai peserta baru; riwayat latihan lama tidak ikut pindah. Peserta di bawah 18 tahun baru masuk analisis setelah fasilitator mencatat persetujuan wali.</div>
  ${kaki(3)}
</section>`);

// 4. Tes awal & beranda
halaman.push(`<section class="hal">
  <span class="bagian">Peserta · 2</span>
  <h1>Tes awal dan beranda</h1>
  <p class="lead">Tes awal mengukur titik berangkat. Tes akhir memakai bentuk yang sama dengan contoh berbeda, jadi kemajuan bisa dibandingkan. Hasilnya hanya terlihat oleh peserta.</p>
  <div class="baris">
    ${hp("18-tes-butir", "Satu butir tes", ["Baca klaim, lalu pilih jenisnya: Benar, Keliru, Menyesatkan, atau Sintetis.", "Pilih seberapa ingin meneruskannya, skala 1 sampai 5. Delapan butir, sekitar 6 menit."])}
    ${hp("19-tes-hasil", "Hasil tes", ["Akurasi dan niat meneruskan tampil untuk diri sendiri. Tidak ada papan peringkat."], 3)}
    ${hp("04-beranda", "Beranda", ["Kartu biru berisi kasus hari ini. Ketuk <b>Mulai latihan</b>.", "Tombol <b>Cek klaim</b> di bawahnya untuk pesan yang baru masuk.", "Ketuk huruf inisial di kanan atas untuk membuka halaman Akun."], 4)}
  </div>
  ${kaki(4)}
</section>`);

// 5. Tahap 1 dan 2
halaman.push(`<section class="hal">
  <span class="bagian">Peserta · 3 · Latihan</span>
  <h1>Jelajah Sumber dan Evaluasi Bukti</h1>
  <p class="lead">Setiap latihan berisi satu kasus lokal bertanda SIMULASI. Jawaban tersimpan tiap tahap; tombol <b>Kembali</b> tidak menghapus pilihan.</p>
  <div class="baris">
    ${hp("05-pengantar-kasus", "Pengantar kasus", ["Baca klaim dan gambar yang beredar.", "Ketuk <b>Mulai latihan</b>. Latihan bisa dilanjutkan nanti."])}
    ${hp("06-tahap1-jelajah-sumber", cip("J", "#dcecfa", "Tahap 1") + " Jelajah Sumber", ["Pilih tepat tiga petunjuk asal-usul.", "Ketuk <b>Periksa pilihanku</b>. Tiap pilihan diberi label dan alasannya, termasuk petunjuk yang terlewat."], 3)}
    ${hp("07-tahap2-evaluasi-bukti", cip("E", "#d9f3e1", "Tahap 2") + " Evaluasi Bukti", ["Pakai kata kunci yang disarankan untuk mencari di mesin pencari.", "Pilih satu sumber primer dan sedikitnya satu pembanding independen, lalu <b>Periksa sumberku</b>."], 5)}
  </div>
  ${kaki(5)}
</section>`);

// 6. Tahap 3 dan Tombol JEDA
halaman.push(`<section class="hal">
  <span class="bagian">Peserta · 4 · Latihan</span>
  <h1>Deteksi Manipulasi dan Tombol JEDA</h1>
  <p class="lead">Tombol JEDA adalah tiga pertanyaan yang muncul sebelum menyalin atau mengirim. Tidak ada pilihan yang tercentang dari awal.</p>
  <div class="baris">
    ${hp("08-tahap3-deteksi-manipulasi", cip("D", "#ffe8d4", "Tahap 3") + " Deteksi Manipulasi", ["Ketuk teknik yang ditemukan, boleh lebih dari satu.", "Buka <b>Apa arti setiap teknik?</b> bila ragu, lalu <b>Periksa pilihanku</b>."])}
    ${hp("09-tahap4-tombol-jeda", cip("A", "#e6e0f5", "Tahap 4") + " Tombol JEDA", ["Jawab: apa buktinya, siapa yang diuntungkan, dan apa akibatnya kalau keliru."], 3)}
    ${hp("10-tombol-jeda-terisi", "Keputusan", ["Pilih seberapa ingin meneruskannya apa adanya.", "Pilih satu sikap: tunda, koreksi dengan santun, laporkan, bagikan dengan konteks, atau abaikan.", "Ketuk <b>Lihat jejak verifikasiku</b>."], 4)}
  </div>
  ${kaki(6)}
</section>`);

// 7. Jejak verifikasi
halaman.push(`<section class="hal">
  <span class="bagian">Peserta · 5</span>
  <h1>Jejak Verifikasi</h1>
  <p class="lead">Jejak adalah catatan pemeriksaan. Jejak lengkap punya empat unsur: sumber primer, pembanding independen, tanggal pemeriksaan, dan konteks klaim. Isinya hanya bisa dibuka pemiliknya; fasilitator dan admin hanya melihat angka gabungan.</p>
  <div class="baris">
    ${hp("11-jejak-verifikasi", "Ringkasan jejak", ["Periksa keempat unsur. Unsur yang kurang diberi tanda dan tombol untuk kembali ke tahap terkait.", "Ketuk <b>Simpan jejak</b>."])}
    ${hp("21-jejak-detail", "Detail jejak", ["<b>Salin</b> untuk menempelkan ringkasan ke pesan balasan.", "<b>Hapus</b> meminta konfirmasi dan tidak bisa dibatalkan."], 3)}
    ${hp("13-daftar-jejak", "Daftar jejak", ["Menu <b>Jejak</b> berisi semua catatan. Titik hijau menunjukkan unsur yang sudah lengkap."], 5)}
  </div>
  ${kaki(7)}
</section>`);

// 8. Cek klaim
halaman.push(`<section class="hal">
  <span class="bagian">Peserta · 6</span>
  <h1>Cek klaim dari luar latihan</h1>
  <p class="lead">Menu <b>Cek</b> dipakai untuk pesan sungguhan yang baru masuk, misalnya di grup WhatsApp. Langkahnya sama dengan latihan, tanpa kunci jawaban.</p>
  <div class="baris">
    ${hp("12-cek-klaim", "Tempel pesan", ["Tempel pesan atau tautan, maksimal 1.000 karakter.", "Ketuk <b>Mulai memeriksa</b>. Kartu J-E-D-A memberi pertanyaan panduan."])}
    ${hp("22-cek-periksa", "Catat pemeriksaan", ["Isi sumber primer, tautan pembanding, tanggal, dan konteks klaim.", "Teks pesan tidak disimpan, kecuali peserta mencentang <b>Simpan teks klaim di jejakku</b>.", "Lanjut ke Tombol JEDA, lalu simpan jejak."], 3)}
    <div class="hp" style="justify-content:flex-start;padding-top:6mm">
      <div class="kotak brand" style="margin:0;font-size:9pt"><b>JEDA tidak memberi vonis.</b><br>Hasil Cek tidak menyatakan pesan benar atau salah. Alat deteksi otomatis hanya petunjuk tambahan; keputusan tetap di tangan pemeriksa.</div>
      <div class="kotak" style="font-size:9pt"><b>Tanpa sinyal?</b><br>Latihan yang sudah dibuka tetap berjalan. Muncul pesan <i>Koneksi terputus. Jawabanmu aman di perangkat</i>, dan jawaban terkirim otomatis saat sinyal kembali.</div>
    </div>
  </div>
  ${kaki(8)}
</section>`);

// 9. Ruang
halaman.push(`<section class="hal">
  <span class="bagian">Peserta · 7</span>
  <h1>Ruang: bank kasus dan studio kartu</h1>
  <p class="lead">Menu <b>Ruang</b> berisi bahan untuk seluruh kelompok belajar.</p>
  <div class="baris">
    ${hp("14-bank-kasus", "Bank kasus", ["Saring kasus menurut teknik dan tema. Ada 12 kasus lokal.", "<b>Latih</b> untuk mengulang kasus, <b>PDF A5</b> untuk mencetak kartu, <b>Laporkan</b> bila ada isi yang keliru."])}
    ${hp("15-studio-kartu", "Studio kartu", ["Ubah hasil pemeriksaan menjadi kartu prebunking atau usulan kasus baru.", "Hapus nama orang, nomor, dan alamat dari klaim.", "Ketuk <b>Ajukan ke fasilitator</b>. Batasnya lima usulan per minggu."], 3)}
    <div class="hp" style="justify-content:flex-start;padding-top:6mm">
      <h2 style="margin-top:0">Alur usulan kartu</h2>
      <ol class="langkah">
        <li><b class="n">1</b><span>Peserta mengajukan dari Studio kartu.</span></li>
        <li><b class="n">2</b><span>Fasilitator menelaah dengan daftar periksa keselamatan, lalu meneruskan, mengembalikan, atau menolak.</span></li>
        <li><b class="n">3</b><span>Pemeriksa fakta melakukan telaah kedua.</span></li>
        <li><b class="n">4</b><span>Kartu terbit di Bank kasus. Status bisa dipantau di bagian Usulanku.</span></li>
      </ol>
    </div>
  </div>
  ${kaki(9)}
</section>`);

// 10. Tim program: dasbor
halaman.push(`<section class="hal">
  <span class="bagian">Tim program · 1</span>
  <h1>Dasbor fasilitator</h1>
  <p class="lead">Masuk lewat <b>Masuk sebagai tim program</b> dari laptop. Semua angka bersifat gabungan; kelompok di bawah lima orang tidak ditampilkan.</p>
  <div style="margin-top:6mm">${layar("d01-dasbor")}</div>
  <table style="margin-top:6mm">
    <thead><tr><th style="width:42%">Indikator</th><th style="width:16%">Target</th><th>Cara membaca</th></tr></thead>
    <tbody>
      <tr><td><b>K1</b> · Akurasi membedakan konten</td><td>naik 20%</td><td>Perubahan skor tes awal ke tes akhir.</td></tr>
      <tr><td><b>K2</b> · Niat membagikan info belum terverifikasi</td><td>turun 15%</td><td>Skala 1–5 dari tes; makin rendah makin hati-hati.</td></tr>
      <tr><td><b>K3</b> · Peserta dengan jejak lengkap</td><td>80%</td><td>Peserta yang punya sedikitnya satu jejak dengan empat unsur.</td></tr>
      <tr><td><b>P1–P5</b> · Metrik pendukung</td><td>tiap baris</td><td>Penyelesaian latihan, durasi, skor SUS, kartu terbit, dan pemakaian Cek.</td></tr>
    </tbody>
  </table>
  <p class="kecil muted" style="margin-top:3mm">Tombol <b>Unduh rekap CSV</b> menghasilkan data tanpa nama dan tanpa teks bebas. <b>Laporan pilot</b> menyusun ringkasan untuk dicetak. Di situs demo, angka berasal dari peserta sintetis.</p>
  ${kaki(10)}
</section>`);

// 11. Kelola ruang & telaah
halaman.push(`<section class="hal">
  <span class="bagian">Tim program · 2</span>
  <h1>Kelola ruang dan telaah usulan</h1>
  <h2>Kelola ruang</h2>
  ${layar("d02-kelola-ruang", "92mm")}
  <ol class="langkah" style="columns:2;column-gap:8mm;margin-top:3mm">
    <li><b class="n">1</b><span><b>Ruang baru</b> membuat kelompok untuk sekitar 20 peserta beserta kodenya.</span></li>
    <li><b class="n">2</b><span>Bagikan kode ruang. <b>Buat ulang kode</b> bila kode tersebar ke luar kelompok.</span></li>
    <li><b class="n">3</b><span>Buka dan tutup tes awal atau tes akhir lewat <b>Jendela tes</b>.</span></li>
    <li><b class="n">4</b><span>Catat persetujuan wali untuk peserta di bawah 18 tahun. Fasilitator tidak melihat jawaban atau jejak peserta.</span></li>
  </ol>
  <h2>Telaah usulan</h2>
  ${layar("d03-telaah", "62mm")}
  <p class="kecil" style="margin-top:3mm">Periksa ulang daftar keselamatan (tanpa wajah atau suara orang nyata, tidak mempermalukan korban, bertanda SIMULASI, tanpa data pribadi). Pilih <b>Teruskan ke pemeriksa fakta</b>, <b>Kembalikan untuk diperbaiki</b> dengan catatan, atau <b>Tolak</b>.</p>
  ${kaki(11)}
</section>`);

// 12. Peran lain & kendala
halaman.push(`<section class="hal">
  <span class="bagian">Tim program · 3</span>
  <h1>Pemeriksa fakta, admin, dan kendala umum</h1>
  <div class="dua" style="margin-top:6mm">
    <div class="kotak" style="margin:0"><b>Pemeriksa fakta</b><p class="kecil" style="margin-top:1.5mm">Melakukan telaah kedua di <b>Telaah usulan</b> dan mengelola bank kasus di <b>Kelola kasus</b>: menyunting, menerbitkan, atau menarik kasus. Kasus yang ditarik langsung hilang dari latihan.</p></div>
    <div class="kotak" style="margin:0"><b>Admin</b><p class="kecil" style="margin-top:1.5mm">Mengatur akun tim dan mengatur ulang kata sandinya, daftar teknik manipulasi dan tema, ekspor data anonim, kebijakan retensi, serta membaca log audit.</p></div>
  </div>
  <h2>Kendala umum</h2>
  <table>
    <thead><tr><th style="width:36%">Yang terjadi</th><th>Yang perlu dilakukan</th></tr></thead>
    <tbody>
      <tr><td>Halaman tidak muncul atau lama sekali</td><td>Server sedang bangun. Tunggu sekitar satu menit, lalu muat ulang.</td></tr>
      <tr><td>“Kode ruang tidak ditemukan.”</td><td>Periksa tanda hubung dan huruf, misalnya <code>JD-07-BKL</code>. Bila masih gagal, tanyakan ke fasilitator; kode mungkin sudah dibuat ulang.</td></tr>
      <tr><td>Kode pribadi lupa</td><td>Masuk lagi dengan kode ruang sebagai peserta baru. Riwayat lama tidak ikut pindah.</td></tr>
      <tr><td>Tes awal atau tes akhir tidak muncul</td><td>Fasilitator belum membuka jendela tes di Kelola ruang.</td></tr>
      <tr><td>Tombol periksa memberi peringatan</td><td>Jumlah pilihan belum sesuai. Tahap 1 meminta tepat tiga petunjuk; Tombol JEDA meminta semua pertanyaan dijawab.</td></tr>
      <tr><td>Dasbor menulis “Data belum cukup”</td><td>Kelompok berisi kurang dari lima orang. Angka akan muncul setelah pesertanya cukup.</td></tr>
      <tr><td>Ingin berhenti dan menghapus data</td><td>Buka Akun, lalu <b>Hapus dataku</b>. Akun, jejak, latihan, dan kode pribadi terhapus; skor tes tetap tersimpan tanpa identitas.</td></tr>
    </tbody>
  </table>
  ${kaki(12)}
</section>`);

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Panduan penggunaan JEDA</title><style>${css}</style></head><body>${halaman.join("")}</body></html>`;
const f = akar("../_kerja/panduan.html");
writeFileSync(f, html);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const p = await browser.newPage();
await p.goto(pathToFileURL(f).href);
await p.evaluate(() => document.fonts.ready);
await p.waitForFunction(() => [...document.images].every((i) => i.complete));
await p.pdf({ path: `${OUT}Panduan-Penggunaan-JEDA.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
// Pratinjau PNG per halaman untuk pemeriksaan visual.
await p.setViewportSize({ width: 794, height: 1123 });
await p.emulateMedia({ media: "print" });
const n = await p.locator("section.hal").count();
for (let i = 0; i < n; i++) await p.locator("section.hal").nth(i).screenshot({ path: akar(`../_kerja/pratinjau-${String(i + 1).padStart(2, "0")}.png`) });
await browser.close();
console.log("panduan selesai,", n, "halaman");
