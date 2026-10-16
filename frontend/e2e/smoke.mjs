// Uji asap ujung ke ujung JEDA (kriteria rilis 2). Jalankan saat API dan Vite hidup:
//   node e2e/smoke.mjs [http://localhost:5173]
// Memakai Microsoft Edge/Chrome yang terpasang (playwright-core, tanpa unduhan peramban).
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:5173";
const SHOTS = fileURLToPath(new URL("./shots/", import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge", headless: true });
const galatKonsol = [];
let lulus = 0;
const cek = (nama, ok) => {
  if (!ok) throw new Error(`GAGAL: ${nama}`);
  lulus++;
  console.log(`  ✓ ${nama}`);
};

async function halaman(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "id-ID" });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && galatKonsol.push(`${p.url()}: ${m.text()}`));
  p.on("pageerror", (e) => galatKonsol.push(`${p.url()}: ${e.message}`));
  return { ctx, p };
}
const foto = (p, nama, fullPage = true) => p.screenshot({ path: `${SHOTS}${nama}.png`, fullPage });

try {
  // ------------------------------------------------------------ peserta baru
  console.log("Peserta baru");
  const { ctx, p } = await halaman();
  await p.goto(`${BASE}/masuk`);
  await foto(p, "01-masuk");
  await p.getByLabel("Kode ruang").fill("JD-00-SALAH");
  await p.getByLabel("Nama samaran").fill("Uji E2E");
  await p.getByRole("button", { name: "Masuk dengan kode ruang" }).click();
  await p.getByText("Kode ruang tidak ditemukan.").waitFor();
  cek("kode salah memberi pesan dan cara memperbaiki", await p.getByText("tanyakan ke fasilitatormu").isVisible());
  await p.getByLabel("Kode ruang").fill("jd-07-bkl");
  await p.getByRole("button", { name: "Masuk dengan kode ruang" }).click();
  await p.getByRole("heading", { name: "Simpan kode pribadimu" }).waitFor();
  const kodePribadi = (await p.locator(".kode-besar").innerText()).trim();
  cek("kode pribadi ditampilkan", /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kodePribadi));
  await foto(p, "02-kode-pribadi");
  await p.getByRole("button", { name: "Aku sudah menyimpannya" }).click();

  await p.getByRole("heading", { name: "Sebelum mulai, baca ini dulu" }).waitFor();
  await p.getByRole("button", { name: "Setuju dan lanjut" }).click();
  cek("persetujuan wajib dicentang", await p.getByText("Centang kotak persetujuan").isVisible());
  await p.getByLabel("18 tahun atau lebih").check();
  await p.getByLabel(/Aku sudah membaca ringkasan/).check();
  await foto(p, "03-persetujuan");
  await p.getByRole("button", { name: "Setuju dan lanjut" }).click();

  // Tes awal
  await p.getByRole("heading", { name: "Tes awal" }).waitFor();
  await p.getByRole("button", { name: "Mulai tes" }).click();
  await foto(p, "04-tes-butir");
  for (let i = 0; i < 8; i++) {
    await p.locator(".choice").first().click();
    await p.locator(".scale label").nth(1).click();
    await p.getByRole("button", { name: i === 7 ? "Kirim jawaban" : "Lanjut" }).click();
  }
  await p.getByRole("heading", { name: /hasilmu/ }).waitFor();
  cek("tes awal terkirim dan hasil hanya untuk diri sendiri", await p.getByText("Tidak ada papan peringkat").isVisible());
  await p.getByRole("link", { name: "Kembali ke Beranda" }).click();

  // Beranda
  await p.getByRole("heading", { name: "Halo, Uji E2E" }).waitFor();
  await p.waitForTimeout(300);
  await foto(p, "05-beranda");
  cek("navigasi bawah lima tab dengan aria-current", (await p.locator(".bottomnav a").count()) === 5 && (await p.locator('.bottomnav a[aria-current="page"]').innerText()).includes("Beranda"));

  // Latihan
  await p.getByRole("link", { name: /Mulai latihan/ }).click();
  await p.getByRole("button", { name: "Mulai latihan" }).waitFor();
  cek("pengantar kasus bertanda SIMULASI", await p.locator(".sim .tag").first().isVisible());
  await foto(p, "06-pengantar");
  await p.getByRole("button", { name: "Mulai latihan" }).click();

  await p.getByText("Tahap 1 dari 4").waitFor();
  await p.getByRole("button", { name: "Periksa pilihanku" }).click();
  cek("tahap 1 menolak sebelum tiga petunjuk", await p.getByText(/petunjuk lagi sebelum memeriksa/).isVisible());
  const petunjuk = p.locator(".choice");
  for (const i of [0, 1, 3]) await petunjuk.nth(i).click();
  await p.getByRole("button", { name: "Periksa pilihanku" }).click();
  cek("umpan balik tahap 1 berupa teks, bukan warna saja", (await p.getByText("Petunjuk yang tepat").count()) >= 1 && (await p.getByText("Bukan petunjuk asal-usul").count()) >= 1);
  await foto(p, "07-tahap1");
  await p.getByRole("button", { name: /Lanjut ke tahap 2/ }).click();

  await p.getByText("Tahap 2 dari 4").waitFor();
  await p.locator('input[name="primer"]').first().check();
  // Pilih pembanding yang bukan independen dulu, untuk memeriksa jejak belum lengkap.
  await p.locator('fieldset:has(legend:has-text("Pembanding")) .choice').nth(1).click();
  await p.getByRole("button", { name: "Periksa sumberku" }).click();
  cek("sumber tidak independen diberi tanda dan alasan", await p.getByText("Bukan independen", { exact: true }).isVisible());
  cek("tahap 2 menyatakan tanpa vonis", await p.getByText("Sistem tidak menyatakan klaim ini benar atau salah.").isVisible());
  await foto(p, "08-tahap2");
  // Kembali tidak menghapus jawaban (FR-2.6)
  await p.getByRole("button", { name: "Kembali" }).click();
  await p.getByText("Tahap 1 dari 4").waitFor();
  cek("kembali tidak menghapus jawaban", (await p.locator(".choice input:checked").count()) === 3);
  await p.getByRole("button", { name: /Lanjut ke tahap 2/ }).click();
  await p.getByRole("button", { name: /Lanjut ke tahap 3/ }).click();

  await p.getByText("Tahap 3 dari 4").waitFor();
  await p.locator(".chip").first().click();
  await p.locator(".chip").nth(1).click();
  await p.getByRole("button", { name: "Periksa pilihanku" }).click();
  cek("tahap 3 menyebut alat deteksi hanya petunjuk", await p.getByText(/Alat deteksi otomatis hanya petunjuk tambahan/).isVisible());
  await foto(p, "09-tahap3");
  await p.getByRole("button", { name: /Lanjut ke tahap 4/ }).click();

  await p.getByText("Tahap 4 dari 4").waitFor();
  cek("Tombol JEDA tanpa pilihan bawaan", (await p.locator("input:checked").count()) === 0);
  await p.getByRole("button", { name: "Lihat jejak verifikasiku" }).click();
  cek("Tombol JEDA menolak sebelum lengkap", await p.getByText(/pertanyaan yang belum dijawab/).isVisible());
  await p.getByLabel("Hanya ada di unggahan ini").check();
  await p.getByLabel("Pembuat tautan konfirmasi").check();
  await p.getByLabel("Data perbankan atau pribadi bisa dicuri").check();
  await p.locator("#jeda-niat label").first().click();
  await p.getByLabel(/Tunda sambil mencari bukti/).check();
  await foto(p, "10-tombol-jeda");
  await p.getByRole("button", { name: "Lihat jejak verifikasiku" }).click();

  await p.getByRole("heading", { name: "Jejak verifikasimu" }).waitFor();
  cek("jejak belum lengkap menyebut pembanding independen", await p.getByText("Jejak belum lengkap: pembanding independen belum dipilih.").isVisible());
  await foto(p, "11-jejak-belum-lengkap");
  await p.getByRole("button", { name: "Kembali ke tahap 2" }).click();
  await p.locator('fieldset:has(legend:has-text("Pembanding")) input:checked').uncheck();
  await p.locator('fieldset:has(legend:has-text("Pembanding")) .choice').first().click();
  await p.getByRole("button", { name: "Periksa sumberku" }).click();
  await p.getByRole("button", { name: /Lanjut ke tahap 3/ }).click();
  await p.getByRole("button", { name: /Lanjut ke tahap 4/ }).click();
  await p.getByRole("button", { name: "Lihat jejak verifikasiku" }).click();
  await p.getByRole("heading", { name: "Jejak verifikasimu" }).waitFor();
  cek("jejak lengkap 4 unsur", (await p.locator(".badge.ok", { hasText: /Sumber primer|Pembanding independen|Tanggal pemeriksaan|Konteks klaim/ }).count()) === 4);
  await p.getByRole("button", { name: "Simpan jejak" }).click();
  await p.getByRole("heading", { name: "Surat biaya transaksi bank" }).or(p.locator("h1")).first().waitFor();
  await p.getByRole("button", { name: "Salin" }).waitFor();
  await foto(p, "12-jejak-detail");
  await p.getByRole("button", { name: "Hapus" }).click();
  cek("hapus jejak meminta konfirmasi", await p.getByText("Jejak yang dihapus tidak bisa dikembalikan.").isVisible());
  await p.getByRole("button", { name: "Batal" }).click();

  // Cek JEDA
  await p.locator(".bottomnav").getByRole("link", { name: "Cek" }).click();
  await p.getByRole("button", { name: "Mulai memeriksa" }).click();
  cek("kolom cek kosong memberi pesan", await p.getByText("Tempel pesan atau tautan yang mau kamu periksa.").isVisible());
  cek("pernyataan tanpa vonis selalu tampil", await p.getByText("JEDA tidak memberi vonis benar atau salah.").isVisible());
  await p.getByLabel("Klaim yang mau diperiksa").fill("Bantuan tunai Rp2 juta cair hari ini, klik bantuan-cepat.xyz untuk konfirmasi");
  await foto(p, "13-cek");
  await p.getByRole("button", { name: "Mulai memeriksa" }).click();
  await p.getByLabel("Sumber primer", { exact: true }).fill("Situs resmi dinas sosial");
  await p.getByLabel("Konteks klaim").fill("Grup kelas, 16 Okt 2026");
  await foto(p, "14-cek-periksa");
  await p.getByRole("button", { name: /Lanjut ke Tombol JEDA/ }).click();
  await p.getByLabel("Aku belum tahu").check();
  await p.getByLabel("Tidak ada pihak yang jelas").check();
  await p.getByLabel("Orang kehilangan uang").check();
  await p.locator("#jeda-niat label").nth(0).click();
  await p.getByLabel(/Laporkan konten/).check();
  await p.getByRole("button", { name: "Simpan jejak" }).click();
  await p.getByRole("button", { name: "Salin" }).waitFor();
  cek("jejak cek tidak menyimpan klaim tanpa izin", await p.getByText("Jejak tanpa teks klaim").isVisible());

  await p.locator(".bottomnav").getByRole("link", { name: "Jejak" }).click();
  await p.locator(".list-item").first().waitFor();
  await foto(p, "15-jejak-daftar");
  cek("daftar jejak memuat dua jejak", (await p.locator(".list-item").count()) === 2);

  // Ruang dan studio kartu
  await p.locator(".bottomnav").getByRole("link", { name: "Ruang" }).click();
  await p.getByRole("heading", { name: "Kasus latihan" }).waitFor();
  await p.waitForFunction(() => document.querySelectorAll("article.card").length >= 12);
  cek("bank kasus minimal 12 kasus", true);
  await foto(p, "16-bank", false);
  await p.getByRole("link", { name: "Studio kartu" }).click();
  await p.getByRole("button", { name: "Ajukan ke fasilitator" }).click();
  cek("studio menolak bidang kosong per bidang", await p.getByText("Tulis klaim yang beredar.").isVisible());
  await foto(p, "17-studio");

  // Mode luring: latihan tersimpan tetap bisa dibuka (FR-8.1/8.3)
  await p.goto(`${BASE}/latihan`);
  await p.locator(".list-item").first().waitFor();
  const href = await p.locator(".list-item").nth(2).getAttribute("href");
  await p.goto(`${BASE}${href}`);
  await p.getByRole("button", { name: "Mulai latihan" }).waitFor();
  await ctx.setOffline(true);
  await p.getByRole("button", { name: "Mulai latihan" }).click();
  await p.getByText("Tahap 1 dari 4").waitFor();
  cek("indikator luring tidak menyalahkan pengguna", await p.getByText("Koneksi terputus. Jawabanmu aman di perangkat").isVisible());
  for (const i of [0, 1, 2]) await p.locator(".choice").nth(i).click();
  await p.getByRole("button", { name: "Periksa pilihanku" }).click();
  await foto(p, "18-luring", false);
  const antre = await p.evaluate(() => JSON.parse(localStorage.getItem("jeda.outbox") || "[]").length);
  cek("jawaban luring masuk antrean perangkat", antre >= 2);
  await ctx.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event("online")));
  await p.waitForFunction(() => JSON.parse(localStorage.getItem("jeda.outbox") || "[]").length === 0, null, { timeout: 15000 });
  cek("antrean terkirim saat sinyal kembali", true);
  await ctx.close();

  // ------------------------------------------------------------ fasilitator (desktop)
  console.log("Fasilitator");
  const f = await halaman({ width: 1280, height: 860 });
  await f.p.goto(`${BASE}/masuk`);
  await f.p.getByRole("button", { name: "Masuk sebagai tim program" }).click();
  await f.p.getByLabel("Surel").fill("sari@jeda.local");
  await f.p.getByLabel("Kata sandi").fill("jeda-fasilitator-2026");
  await f.p.getByRole("button", { name: "Masuk", exact: true }).click();
  await f.p.getByRole("heading", { name: "Dasbor fasilitator" }).waitFor();
  await f.p.getByText("K1 · Akurasi").first().waitFor();
  cek("dasbor memberi catatan angka ilustrasi", await f.p.getByText("Angka di layar ini hanya ilustrasi").isVisible());
  await f.p.waitForTimeout(300);
  await foto(f.p, "20-dasbor");
  await f.p.getByRole("link", { name: "Kelola ruang" }).click();
  await f.p.getByRole("heading", { name: "Persetujuan peserta" }).waitFor();
  await foto(f.p, "21-kelola-ruang", false);
  await f.p.getByRole("link", { name: "Telaah usulan" }).click();
  await f.p.locator("article.card").first().waitFor();
  await foto(f.p, "22-telaah", false);
  await f.ctx.close();

  // Ruang kecil k<5
  const dm = await halaman({ width: 1280, height: 860 });
  await dm.p.goto(`${BASE}/masuk`);
  await dm.p.getByRole("button", { name: "Masuk sebagai tim program" }).click();
  await dm.p.getByLabel("Surel").fill("dimas@jeda.local");
  await dm.p.getByLabel("Kata sandi").fill("jeda-fasilitator-2026");
  await dm.p.getByRole("button", { name: "Masuk", exact: true }).click();
  await dm.p.getByRole("heading", { name: "Dasbor fasilitator" }).waitFor();
  await dm.p.getByText(/Data belum cukup/).first().waitFor();
  cek("ruang 4 peserta: data belum cukup", (await dm.p.getByText(/Data belum cukup/).count()) >= 1);
  await foto(dm.p, "23-dasbor-k5", false);
  await dm.ctx.close();

  // Admin
  console.log("Admin dan pemeriksa");
  const ad = await halaman({ width: 1280, height: 860 });
  await ad.p.goto(`${BASE}/masuk`);
  await ad.p.getByRole("button", { name: "Masuk sebagai tim program" }).click();
  await ad.p.getByLabel("Surel").fill("admin@jeda.local");
  await ad.p.getByLabel("Kata sandi").fill("jeda-admin-2026");
  await ad.p.getByRole("button", { name: "Masuk", exact: true }).click();
  await ad.p.getByRole("heading", { name: "Dasbor fasilitator" }).waitFor();
  await ad.p.getByRole("link", { name: "Admin", exact: true }).click();
  await ad.p.getByRole("button", { name: "Log audit" }).click();
  await ad.p.locator(".tbl tbody tr").first().waitFor();
  await foto(ad.p, "24-admin-audit", false);
  cek("log audit tampil", (await ad.p.locator(".tbl tbody tr").count()) > 3);
  await ad.ctx.close();

  const pf = await halaman({ width: 1280, height: 860 });
  await pf.p.goto(`${BASE}/masuk`);
  await pf.p.getByRole("button", { name: "Masuk sebagai tim program" }).click();
  await pf.p.getByLabel("Surel").fill("hendra@jeda.local");
  await pf.p.getByLabel("Kata sandi").fill("jeda-pemeriksa-2026");
  await pf.p.getByRole("button", { name: "Masuk", exact: true }).click();
  await pf.p.getByRole("heading", { name: "Telaah usulan" }).waitFor();
  await pf.p.getByRole("link", { name: "Kelola kasus" }).click();
  await pf.p.locator(".tbl tbody tr").first().waitFor();
  cek("pemeriksa melihat kelola kasus", (await pf.p.locator(".tbl tbody tr").count()) >= 12);
  await foto(pf.p, "25-kelola-kasus", false);
  await pf.ctx.close();

  const bocor = galatKonsol.filter((g) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(g));
  if (bocor.length) console.log("Galat konsol:\n  " + bocor.join("\n  "));
  cek("tanpa galat konsol", bocor.length === 0);
  console.log(`\n${lulus} pemeriksaan lulus.`);
} catch (e) {
  console.error(e.message);
  if (galatKonsol.length) console.error("Galat konsol:\n  " + galatKonsol.join("\n  "));
  process.exitCode = 1;
} finally {
  await browser.close();
}
