// Tangkapan layar bersih (viewport 390x844, skala 3) untuk mockup dan PDF panduan.
//   node materi/_skrip/tangkap.mjs [http://localhost:5173]
import { chromium } from "../../frontend/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = fileURLToPath(new URL("../_kerja/layar/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: "id-ID" });
const p = await ctx.newPage();
const tunggu = (ms = 350) => p.waitForTimeout(ms);
const foto = async (nama) => { await tunggu(); await p.locator(".toast").waitFor({ state: "hidden", timeout: 6000 }).catch(() => {}); await p.screenshot({ path: `${OUT}${nama}.png` }); console.log("  ", nama); };
// Gulir supaya elemen berada di posisi tertentu dari atas layar.
const gulir = async (loc, atas = 90) => {
  await loc.first().evaluate((el, a) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - a), atas);
};

// Minggu pertama pilot: fasilitator menutup tes akhir ruang 07 (hanya di basis data lokal).
{
  const r = await ctx.request.post(`${BASE}/api/masuk/staf`, { data: { surel: "sari@jeda.local", kata_sandi: "jeda-fasilitator-2026" } });
  if (!r.ok()) console.log("login staf gagal", r.status(), await r.text());
  const daftar = await (await ctx.request.get(`${BASE}/api/ruang`)).json();
  const r07 = (daftar.ruang ?? daftar).find((x) => x.kode === "JD-07-BKL");
  const u = await ctx.request.patch(`${BASE}/api/ruang/${r07.id}`, { data: { tes_akhir_buka: false } });
  console.log("tes akhir ditutup:", u.ok());
  await ctx.clearCookies();
}
// Mockup memperlihatkan tampilan pilot: pita "Lingkungan uji" disembunyikan di layar peserta.
await p.addInitScript(() => {
  const st = () => { const e = document.createElement("style"); e.textContent = ".strip{display:none!important}.auth-form>.badge.warn{display:none!important}"; document.head.appendChild(e); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", st) : st();
});

try {
  await p.goto(`${BASE}/masuk`);
  await p.getByLabel("Kode ruang").waitFor();
  await foto("m01-masuk");
  await p.getByLabel("Kode ruang").fill("JD-07-BKL");
  await p.getByLabel("Nama samaran").fill("Nadia");
  await foto("m01b-masuk-isi");
  await p.getByRole("button", { name: "Masuk dengan kode ruang" }).click();
  await p.getByRole("heading", { name: "Simpan kode pribadimu" }).waitFor();
  await foto("m02-kode-pribadi");
  await p.getByRole("button", { name: "Aku sudah menyimpannya" }).click();

  await p.getByRole("heading", { name: "Sebelum mulai, baca ini dulu" }).waitFor();
  await foto("m03-persetujuan");
  await p.getByLabel("18 tahun atau lebih").check();
  await p.getByLabel(/Aku sudah membaca ringkasan/).check();
  await p.getByRole("button", { name: "Setuju dan lanjut" }).click();

  await p.getByRole("heading", { name: "Tes awal" }).waitFor();
  await foto("m04-tes-awal");
  await p.getByRole("button", { name: "Mulai tes" }).click();
  await p.locator(".choice").first().waitFor();
  await foto("m04b-tes-butir");
  for (let i = 0; i < 8; i++) {
    await p.locator(".choice").nth(i % 2).click();
    await p.locator(".scale label").nth(2).click();
    await p.getByRole("button", { name: i === 7 ? "Kirim jawaban" : "Lanjut" }).click();
  }
  await p.getByRole("heading", { name: /hasilmu/ }).waitFor();
  await foto("m04c-tes-hasil");
  await p.getByRole("link", { name: "Kembali ke Beranda" }).click();

  await p.getByRole("heading", { name: "Halo, Nadia" }).waitFor();
  await foto("m05-beranda");
  await p.evaluate(() => window.scrollTo(0, 620));
  await foto("m05b-beranda-tahap");

  await p.getByRole("link", { name: /Mulai latihan/ }).first().click();
  await p.getByRole("button", { name: "Mulai latihan" }).waitFor();
  await foto("m06-pengantar");
  await p.getByRole("button", { name: "Mulai latihan" }).click();

  await p.getByText("Tahap 1 dari 4").waitFor();
  await foto("m07-tahap1");
  for (const i of [0, 1, 3]) await p.locator(".choice").nth(i).click();
  await p.getByRole("button", { name: "Periksa pilihanku" }).click();
  await p.getByText("Petunjuk yang tepat").first().waitFor();
  await gulir(p.locator("fieldset"), 70);
  await foto("m07b-tahap1-umpan");
  await p.getByRole("button", { name: /Lanjut ke tahap 2/ }).click();

  await p.getByText("Tahap 2 dari 4").waitFor();
  await foto("m08-tahap2");
  await p.locator('input[name="primer"]').first().check();
  await p.locator('fieldset:has(legend:has-text("Pembanding")) .choice').first().click();
  await p.getByRole("button", { name: "Periksa sumberku" }).click();
  await p.getByText("Sistem tidak menyatakan klaim ini benar atau salah.").waitFor();
  await gulir(p.locator("fieldset"), 70);
  await foto("m08b-tahap2-umpan");
  await p.getByRole("button", { name: /Lanjut ke tahap 3/ }).click();

  await p.getByText("Tahap 3 dari 4").waitFor();
  await foto("m09-tahap3");
  await p.locator(".chip").first().click();
  await p.locator(".chip").nth(1).click();
  await p.getByRole("button", { name: "Periksa pilihanku" }).click();
  await p.getByText(/Alat deteksi otomatis hanya petunjuk tambahan/).waitFor();
  await gulir(p.locator(".chips"), 120);
  await foto("m09b-tahap3-umpan");
  await p.getByRole("button", { name: /Lanjut ke tahap 4/ }).click();

  await p.getByText("Tahap 4 dari 4").waitFor();
  await foto("m10-tombol-jeda");
  await p.getByLabel("Hanya ada di unggahan ini").check();
  await p.getByLabel("Pembuat tautan konfirmasi").check();
  await p.getByLabel("Data perbankan atau pribadi bisa dicuri").check();
  await p.locator("#jeda-niat label").first().click();
  await p.getByLabel(/Tunda sambil mencari bukti/).check();
  await gulir(p.locator("#jeda-niat"), 70);
  await foto("m10b-tombol-jeda-isi");
  await p.getByRole("button", { name: "Lihat jejak verifikasiku" }).click();

  await p.getByRole("heading", { name: "Jejak verifikasimu" }).waitFor();
  await foto("m11-jejak-ringkas");
  await p.getByRole("button", { name: "Simpan jejak" }).click();
  await p.getByRole("button", { name: "Salin" }).waitFor();
  await foto("m12-jejak-detail");

  await p.locator(".bottomnav").getByRole("link", { name: "Cek" }).click();
  await p.getByLabel("Klaim yang mau diperiksa").waitFor();
  await foto("m13-cek");
  await p.getByLabel("Klaim yang mau diperiksa").fill("Bantuan tunai Rp2 juta cair hari ini, klik bantuan-cepat.xyz untuk konfirmasi");
  await foto("m13b-cek-isi");
  await p.getByRole("button", { name: "Mulai memeriksa" }).click();
  await p.getByLabel("Sumber primer", { exact: true }).fill("Situs resmi dinas sosial");
  await p.getByLabel("Konteks klaim").fill("Grup WhatsApp kelas, 16 Okt 2026");
  await foto("m14-cek-periksa");
  await p.getByRole("button", { name: /Lanjut ke Tombol JEDA/ }).click();
  await p.getByLabel("Aku belum tahu").check();
  await p.getByLabel("Tidak ada pihak yang jelas").check();
  await p.getByLabel("Orang kehilangan uang").check();
  await p.locator("#jeda-niat label").nth(0).click();
  await p.getByLabel(/Laporkan konten/).check();
  await p.getByRole("button", { name: "Simpan jejak" }).click();
  await p.getByRole("button", { name: "Salin" }).waitFor();

  await p.locator(".bottomnav").getByRole("link", { name: "Jejak" }).click();
  await p.locator(".list-item").first().waitFor();
  await foto("m15-jejak-daftar");

  await p.locator(".bottomnav").getByRole("link", { name: "Ruang" }).click();
  await p.getByRole("heading", { name: "Kasus latihan" }).waitFor();
  await p.waitForFunction(() => document.querySelectorAll("article.card").length >= 12);
  await foto("m16-ruang");
  await p.getByRole("link", { name: "Studio kartu" }).click();
  await tunggu(600);
  await foto("m17-studio");
  await ctx.close();

  // Tim program, layar laptop
  const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "id-ID" });
  const f = await d.newPage();
  await f.goto(`${BASE}/masuk`);
  await f.waitForTimeout(500);
  await f.screenshot({ path: `${OUT}d00-masuk.png` });
  await f.getByRole("button", { name: "Masuk sebagai tim program" }).click();
  await f.getByLabel("Surel").fill("sari@jeda.local");
  await f.getByLabel("Kata sandi").fill("jeda-fasilitator-2026");
  await f.getByRole("button", { name: "Masuk", exact: true }).click();
  await f.getByRole("heading", { name: "Dasbor fasilitator" }).waitFor();
  await f.getByText("K1 · Akurasi").first().waitFor();
  await f.waitForTimeout(600);
  await f.screenshot({ path: `${OUT}d01-dasbor.png` });
  await f.screenshot({ path: `${OUT}d01b-dasbor-penuh.png`, fullPage: true });
  await f.getByRole("link", { name: "Kelola ruang" }).click();
  await f.getByRole("heading", { name: "Persetujuan peserta" }).waitFor();
  await f.waitForTimeout(400);
  await f.screenshot({ path: `${OUT}d02-kelola-ruang.png` });
  await f.getByRole("link", { name: "Telaah usulan" }).click();
  await f.locator("article.card").first().waitFor();
  await f.waitForTimeout(400);
  await f.screenshot({ path: `${OUT}d03-telaah.png` });
  console.log("selesai");
} finally {
  await browser.close();
}
