// Merekam alur demo lewat CDP screencast, dengan jeda tiap adegan mengikuti durasi narasi.
//   node materi/_skrip/rekam.mjs [http://localhost:5173]
import { chromium } from "../../frontend/node_modules/playwright-core/index.mjs";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:5173";
const akar = (p) => fileURLToPath(new URL(p, import.meta.url));
const DUR = JSON.parse(readFileSync(akar("../_kerja/suara/durasi.json"), "utf8"));
const now = () => Date.now() / 1000;
const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

const HANYA = process.argv[3]; // "desktop" = hanya rekam ulang adegan dasbor
const browser = await chromium.launch({ channel: "msedge", headless: true });

// Lingkaran sentuh: penonton bisa melihat di mana jari "mengetuk".
const skripSentuh = () => {
  const pasang = () => {
    const st = document.createElement("style");
    st.textContent = `.strip{display:none!important}.auth-form>.badge.warn{display:none!important}
      .sentuh{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(18,53,127,.22);border:2px solid rgba(18,53,127,.45);pointer-events:none;z-index:2147483647;animation:sentuh .55s ease-out forwards}
      @keyframes sentuh{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.25);opacity:0}}
      html{scroll-behavior:auto}`;
    document.head.appendChild(st);
    addEventListener("pointerdown", (e) => {
      const d = document.createElement("div");
      d.className = "sentuh"; d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px";
      document.body.appendChild(d); setTimeout(() => d.remove(), 700);
    }, true);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", pasang) : pasang();
};

async function rekaman(nama, page) {
  const dir = akar(`../_kerja/rekam/${nama}/`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const marks = [];
  cdp.on("Page.screencastFrame", async (f) => {
    const i = frames.length;
    frames.push(f.metadata.timestamp ?? now());
    writeFileSync(`${dir}f${String(i).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64"));
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
  });
  const vp = page.viewportSize();
  const skala = nama === "mobile" ? 2 : 1;
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: vp.width * skala, maxHeight: vp.height * skala, everyNthFrame: 1 });
  const mulai = now();
  return {
    async adegan(k, fn) {
      const t0 = now();
      marks.push([k, t0]);
      console.log("  ", k);
      await fn();
      const sisa = t0 + DUR[k] + 1.0 - now();
      if (sisa > 0) await jeda(sisa * 1000);
    },
    async selesai() {
      await jeda(400);
      const akhir = now();
      await cdp.send("Page.stopScreencast");
      writeFileSync(`${dir}waktu.json`, JSON.stringify({ mulai, akhir, frames, marks }, null, 1));
    },
  };
}

// Gulir halus buatan sendiri (rAF + easing), karena smooth scroll bawaan bisa melompat di mode headless.
const animasiGulir = (target, ms) =>
  new Promise((selesai) => {
    const awal = window.scrollY;
    const maks = document.documentElement.scrollHeight - innerHeight;
    const tujuan = Math.max(0, Math.min(maks, target));
    const t0 = performance.now();
    const langkah = (t) => {
      const x = Math.min(1, (t - t0) / ms);
      const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      window.scrollTo(0, awal + (tujuan - awal) * e);
      x < 1 ? requestAnimationFrame(langkah) : selesai();
    };
    requestAnimationFrame(langkah);
  });
// Gulir supaya elemen berada `atas` px dari tepi atas layar.
const lihat = async (page, loc, atas = 110, ms = 750) => {
  const y = await loc.first().evaluate((el, a) => el.getBoundingClientRect().top + window.scrollY - a, atas);
  await page.evaluate(`(${animasiGulir})(${y}, ${Math.max(350, ms - 150)})`);
  await page.waitForTimeout(150);
};
const gulirKe = async (page, y, ms = 750) => {
  await page.evaluate(`(${animasiGulir})(${y}, ${Math.max(350, ms - 150)})`);
  await page.waitForTimeout(150);
};
const ketuk = async (page, loc, tunggu = 550) => {
  await loc.click();
  await page.waitForTimeout(tunggu);
};

try {
  if (HANYA !== "desktop") {
  // ------------------------------------------------------------ peserta (ponsel)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "id-ID", hasTouch: false });
  await ctx.addInitScript(skripSentuh);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/masuk`);
  await p.getByLabel("Kode ruang").waitFor();
  await p.waitForTimeout(800);
  const r = await rekaman("mobile", p);

  await r.adegan("s02", async () => {
    await jeda(1800);
    await ketuk(p, p.getByLabel("Kode ruang"), 300);
    await p.getByLabel("Kode ruang").pressSequentially("JD-07-BKL", { delay: 85 });
    await jeda(500);
    await ketuk(p, p.getByLabel("Nama samaran"), 300);
    await p.getByLabel("Nama samaran").pressSequentially("Nadia", { delay: 110 });
    await jeda(1400);
    await ketuk(p, p.getByRole("button", { name: "Masuk dengan kode ruang" }));
    await p.getByRole("heading", { name: "Simpan kode pribadimu" }).waitFor();
  });

  await r.adegan("s03", async () => {
    await jeda(3800);
    await ketuk(p, p.getByRole("button", { name: "Aku sudah menyimpannya" }));
    await p.getByRole("heading", { name: "Sebelum mulai, baca ini dulu" }).waitFor();
    await jeda(1500);
    await gulirKe(p, 330, 1600);
    await gulirKe(p, 760, 1600);
    await lihat(p, p.getByLabel("18 tahun atau lebih"), 300);
    await ketuk(p, p.getByLabel("18 tahun atau lebih"));
    await ketuk(p, p.getByLabel(/Aku sudah membaca ringkasan/), 800);
  });

  await r.adegan("s04", async () => {
    await ketuk(p, p.getByRole("button", { name: "Setuju dan lanjut" }));
    await p.getByRole("heading", { name: "Tes awal" }).waitFor();
    await jeda(1600);
    await ketuk(p, p.getByRole("button", { name: "Mulai tes" }));
    for (let i = 0; i < 8; i++) {
      await p.locator(".choice").first().waitFor();
      await jeda(i < 2 ? 1300 : 350);
      await ketuk(p, p.locator(".choice").nth([2, 0, 1, 3, 0, 2, 1, 3][i]), i < 2 ? 600 : 220);
      await ketuk(p, p.locator(".scale label").nth([1, 2, 0, 1, 3, 1, 2, 0][i]), i < 2 ? 700 : 220);
      await ketuk(p, p.getByRole("button", { name: i === 7 ? "Kirim jawaban" : "Lanjut" }), 250);
    }
    await p.getByRole("heading", { name: /hasilmu/ }).waitFor();
  });

  await r.adegan("s05", async () => {
    await jeda(1200);
    await ketuk(p, p.getByRole("link", { name: "Kembali ke Beranda" }));
    await p.getByRole("heading", { name: "Halo, Nadia" }).waitFor();
    await jeda(2600);
    await ketuk(p, p.getByRole("link", { name: /Mulai latihan/ }).first());
    await p.getByRole("button", { name: "Mulai latihan" }).waitFor();
    await jeda(1800);
    await lihat(p, p.locator(".sim").first(), 140, 1200);
  });

  await r.adegan("s06", async () => {
    await jeda(600);
    await ketuk(p, p.getByRole("button", { name: "Mulai latihan" }));
    await p.getByText("Tahap 1 dari 4").waitFor();
    await jeda(2200);
    await lihat(p, p.locator("fieldset"), 90, 900);
    for (const i of [0, 1, 3]) await ketuk(p, p.locator(".choice").nth(i), 900);
    await lihat(p, p.getByRole("button", { name: "Periksa pilihanku" }), 600, 700);
    await ketuk(p, p.getByRole("button", { name: "Periksa pilihanku" }));
    await p.getByText("Petunjuk yang tepat").first().waitFor();
    await lihat(p, p.locator("fieldset"), 70, 1200);
    await jeda(2500);
    await gulirKe(p, await p.evaluate(() => window.scrollY + 330), 1500);
  });

  await r.adegan("s07", async () => {
    await lihat(p, p.getByRole("button", { name: /Lanjut ke tahap 2/ }), 500, 600);
    await ketuk(p, p.getByRole("button", { name: /Lanjut ke tahap 2/ }));
    await p.getByText("Tahap 2 dari 4").waitFor();
    await jeda(2000);
    await lihat(p, p.locator('input[name="primer"]').first(), 200, 1000);
    await ketuk(p, p.locator('fieldset:has(legend:has-text("Sumber primer")) .choice').first(), 900);
    await lihat(p, p.locator('fieldset:has(legend:has-text("Pembanding"))'), 120, 900);
    await ketuk(p, p.locator('fieldset:has(legend:has-text("Pembanding")) .choice').first(), 900);
    await lihat(p, p.getByRole("button", { name: "Periksa sumberku" }), 600, 700);
    await ketuk(p, p.getByRole("button", { name: "Periksa sumberku" }));
    await p.getByText("Sistem tidak menyatakan klaim ini benar atau salah.").waitFor();
    await lihat(p, p.locator('fieldset:has(legend:has-text("Sumber primer"))'), 80, 1400);
    await jeda(2200);
    await lihat(p, p.getByText("Sistem tidak menyatakan klaim ini benar atau salah."), 380, 1400);
  });

  await r.adegan("s08", async () => {
    await ketuk(p, p.getByRole("button", { name: /Lanjut ke tahap 3/ }));
    await p.getByText("Tahap 3 dari 4").waitFor();
    await jeda(1800);
    await lihat(p, p.locator(".chips"), 330, 1000);
    await ketuk(p, p.locator(".chip").first(), 900);
    await ketuk(p, p.locator(".chip").nth(1), 900);
    await ketuk(p, p.getByRole("button", { name: "Periksa pilihanku" }));
    await p.getByText(/Alat deteksi otomatis hanya petunjuk tambahan/).waitFor();
    await lihat(p, p.locator(".chips"), 120, 1200);
  });

  await r.adegan("s09", async () => {
    await lihat(p, p.getByRole("button", { name: /Lanjut ke tahap 4/ }), 600, 500);
    await ketuk(p, p.getByRole("button", { name: /Lanjut ke tahap 4/ }));
    await p.getByText("Tahap 4 dari 4").waitFor();
    await jeda(2600);
    await lihat(p, p.getByText("1. Apa buktinya?"), 120, 900);
    await ketuk(p, p.getByLabel("Hanya ada di unggahan ini"), 1100);
    await lihat(p, p.getByText("2. Siapa yang diuntungkan?"), 120, 900);
    await ketuk(p, p.getByLabel("Pembuat tautan konfirmasi"), 1100);
    await lihat(p, p.getByLabel("Data perbankan atau pribadi bisa dicuri"), 260, 900);
    await ketuk(p, p.getByLabel("Data perbankan atau pribadi bisa dicuri"), 1100);
    await lihat(p, p.locator("#jeda-niat"), 90, 900);
    await ketuk(p, p.locator("#jeda-niat label").first(), 900);
    await ketuk(p, p.getByLabel(/Tunda sambil mencari bukti/), 1000);
  });

  await r.adegan("s10", async () => {
    await lihat(p, p.getByRole("button", { name: "Lihat jejak verifikasiku" }), 600, 500);
    await ketuk(p, p.getByRole("button", { name: "Lihat jejak verifikasiku" }));
    await p.getByRole("heading", { name: "Jejak verifikasimu" }).waitFor();
    await jeda(3000);
    await gulirKe(p, 300, 1600);
    await jeda(1800);
    await lihat(p, p.getByRole("button", { name: "Simpan jejak" }), 560, 900);
    await ketuk(p, p.getByRole("button", { name: "Simpan jejak" }));
    await p.getByRole("button", { name: "Salin" }).waitFor();
    await jeda(2200);
    await gulirKe(p, 260, 1500);
  });

  await r.adegan("s11", async () => {
    await ketuk(p, p.locator(".bottomnav").getByRole("link", { name: "Cek" }));
    await p.getByLabel("Klaim yang mau diperiksa").waitFor();
    await jeda(900);
    await ketuk(p, p.getByLabel("Klaim yang mau diperiksa"), 300);
    await p.getByLabel("Klaim yang mau diperiksa").pressSequentially("Bantuan tunai Rp2 juta cair hari ini, klik bantuan-cepat.xyz untuk konfirmasi", { delay: 22 });
    await jeda(600);
    await lihat(p, p.getByRole("button", { name: "Mulai memeriksa" }), 600, 500);
    await ketuk(p, p.getByRole("button", { name: "Mulai memeriksa" }));
    await p.getByLabel("Sumber primer", { exact: true }).waitFor();
    await lihat(p, p.getByLabel("Sumber primer", { exact: true }), 260, 700);
    await ketuk(p, p.getByLabel("Sumber primer", { exact: true }), 200);
    await p.getByLabel("Sumber primer", { exact: true }).pressSequentially("Situs resmi dinas sosial", { delay: 35 });
    await lihat(p, p.getByLabel("Konteks klaim"), 300, 700);
    await ketuk(p, p.getByLabel("Konteks klaim"), 200);
    await p.getByLabel("Konteks klaim").pressSequentially("Grup WhatsApp kelas, 16 Okt 2026", { delay: 35 });
    await jeda(500);
    await ketuk(p, p.getByRole("button", { name: /Lanjut ke Tombol JEDA/ }));
    await lihat(p, p.getByLabel("Aku belum tahu"), 300, 700);
    await ketuk(p, p.getByLabel("Aku belum tahu"), 350);
    await ketuk(p, p.getByLabel("Tidak ada pihak yang jelas"), 350);
    await ketuk(p, p.getByLabel("Orang kehilangan uang"), 350);
    await lihat(p, p.locator("#jeda-niat"), 90, 700);
    await ketuk(p, p.locator("#jeda-niat label").nth(0), 350);
    await ketuk(p, p.getByLabel(/Laporkan konten/), 500);
    await ketuk(p, p.getByRole("button", { name: "Simpan jejak" }));
    await p.getByRole("button", { name: "Salin" }).waitFor();
  });

  await r.adegan("s12", async () => {
    await jeda(500);
    await ketuk(p, p.locator(".bottomnav").getByRole("link", { name: "Ruang" }));
    await p.getByRole("heading", { name: "Kasus latihan" }).waitFor();
    await jeda(1500);
    await gulirKe(p, 380, 1400);
    await gulirKe(p, 1100, 1800);
    await gulirKe(p, 0, 1000);
    await ketuk(p, p.getByRole("link", { name: "Studio kartu" }));
    await jeda(1800);
    await gulirKe(p, 320, 1500);
  });
  await r.selesai();
  await ctx.close();

  }
  // ------------------------------------------------------------ fasilitator (laptop)
  const d = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: "id-ID" });
  await d.addInitScript(skripSentuh);
  const f = await d.newPage();
  await f.goto(`${BASE}/masuk`);
  await f.getByRole("button", { name: "Masuk sebagai tim program" }).click();
  await f.getByLabel("Surel").fill("sari@jeda.local");
  await f.getByLabel("Kata sandi").fill("jeda-fasilitator-2026");
  await f.getByRole("button", { name: "Masuk", exact: true }).click();
  await f.getByRole("heading", { name: "Dasbor fasilitator" }).waitFor();
  await f.getByText("K1 · Akurasi").first().waitFor();
  await f.waitForTimeout(1200);
  const rd = await rekaman("desktop", f);
  await rd.adegan("s13", async () => {
    await jeda(7500);
    await gulirKe(f, 330, 2400);
    await jeda(4500);
    await gulirKe(f, 760, 2400);
    await jeda(1500);
  });
  await rd.selesai();
  await d.close();
  console.log("selesai");
} finally {
  await browser.close();
}
