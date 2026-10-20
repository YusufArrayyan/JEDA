// Menyusun mockup ponsel dari tangkapan layar asli (materi/_kerja/layar) menjadi PNG untuk esai.
//   node materi/_skrip/mockup.mjs
import { chromium } from "../../frontend/node_modules/playwright-core/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const akar = (p) => fileURLToPath(new URL(p, import.meta.url));
const url = (p) => pathToFileURL(akar(p)).href;
const LAYAR = (n) => url(`../_kerja/layar/${n}.png`);
const OUT = akar("../mockup/");
mkdirSync(OUT + "satuan", { recursive: true });
const FONT = url("../../frontend/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const LOGO = url("../_kerja/logo-crop.png");

const css = `
@font-face { font-family: Inter; src: url(${FONT}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { font-family: Inter, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; }
.hp { width: 418px; padding: 13px; border-radius: 64px; background: #1b1c1f; position: relative; flex: none;
  box-shadow: inset 0 0 0 2px #3a3c41, 0 1px 0 1px #0d0e10, 0 40px 60px -30px rgba(15, 25, 50, .35), 0 18px 24px -18px rgba(15, 25, 50, .25); }
.hp::before, .hp::after { content: ""; position: absolute; width: 4px; background: #2a2c30; border-radius: 2px; }
.hp::before { left: -3px; top: 180px; height: 64px; box-shadow: 0 84px 0 #2a2c30; }
.hp::after { right: -3px; top: 220px; height: 96px; }
.scr { width: 392px; height: 915px; border-radius: 52px; overflow: hidden; background: #fff; position: relative; }
.sb { height: 49px; display: flex; align-items: center; justify-content: space-between; padding: 6px 30px 0 40px; font-weight: 600; font-size: 16px; letter-spacing: -.01em; }
.sb svg { display: block; }
.isl { position: absolute; top: 11px; left: 50%; transform: translateX(-50%); width: 122px; height: 35px; border-radius: 20px; background: #000; }
.scr img.s { display: block; width: 392px; }
.home { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 136px; height: 5px; border-radius: 3px; background: #1a1a1a; }
`;

const ikonSb = `<span style="display:flex;gap:6px;align-items:center">
<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#111"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#111"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z M3.4 6.8a6.6 6.6 0 0 1 9.2 0l-1.2 1.2a4.9 4.9 0 0 0-6.8 0Z M1.2 4.6a9.7 9.7 0 0 1 13.6 0l-1.1 1.1a8.2 8.2 0 0 0-11.4 0Z" fill="#111"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#111" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#111"/><rect x="25" y="4.5" width="1.6" height="4" rx=".8" fill="#111" opacity=".4"/></svg></span>`;

export const ponsel = (layar, gaya = "") =>
  `<div class="hp" style="${gaya}"><div class="scr"><div class="sb"><span>09.41</span>${ikonSb}</div><img class="s" src="${LAYAR(layar)}"><div class="isl"></div><div class="home"></div></div></div>`;

const halaman = (isi, lebar, tinggi, latar = "transparent", tambahan = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${css} html,body{width:${lebar}px;height:${tinggi}px;background:${latar};overflow:hidden} ${tambahan}</style></head><body>${isi}</body></html>`;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const p = await ctx.newPage();
const KERJA = akar("../_kerja/");
async function render(nama, html, lebar, tinggi, transparan = false) {
  const f = `${KERJA}tmp-${nama.replace(/\//g, "_")}.html`;
  writeFileSync(f, html);
  await p.setViewportSize({ width: lebar, height: tinggi });
  await p.goto(pathToFileURL(f).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete));
  await p.screenshot({ path: `${OUT}${nama}.png`, omitBackground: transparan });
  console.log("  ", nama);
}

// ---------- 1. Satuan: tiap layar dalam bingkai, latar transparan
const satuan = {
  "01-masuk": "m01-masuk",
  "02-kode-pribadi": "m02-kode-pribadi",
  "03-persetujuan": "m03-persetujuan",
  "04-beranda": "m05-beranda",
  "05-pengantar-kasus": "m06-pengantar",
  "06-tahap1-jelajah-sumber": "m07b-tahap1-umpan",
  "07-tahap2-evaluasi-bukti": "m08b-tahap2-umpan",
  "08-tahap3-deteksi-manipulasi": "m09b-tahap3-umpan",
  "09-tahap4-tombol-jeda": "m10-tombol-jeda",
  "10-tombol-jeda-terisi": "m10b-tombol-jeda-isi",
  "11-jejak-verifikasi": "m11-jejak-ringkas",
  "12-cek-klaim": "m13b-cek-isi",
  "13-daftar-jejak": "m15-jejak-daftar",
  "14-bank-kasus": "m16-ruang",
  "15-studio-kartu": "m17-studio",
  "16-masuk-terisi": "m01b-masuk-isi",
  "17-tes-awal": "m04-tes-awal",
  "18-tes-butir": "m04b-tes-butir",
  "19-tes-hasil": "m04c-tes-hasil",
  "20-tahap1-awal": "m07-tahap1",
  "21-jejak-detail": "m12-jejak-detail",
  "22-cek-periksa": "m14-cek-periksa",
  "23-beranda-tahap": "m05b-beranda-tahap",
};
for (const [nama, layar] of Object.entries(satuan)) {
  await render(`satuan/${nama}`, halaman(`<div style="padding:30px 34px 60px">${ponsel(layar)}</div>`, 486, 1040), 486, 1040, true);
}

// ---------- 2. Papan utama: tiga layar inti
const label = (judul, sub) => `<div class="lb"><b>${judul}</b><span>${sub}</span></div>`;
const cssPapan = `
.papan { position: relative; width: 100%; height: 100%; padding: 96px 110px; display: flex; flex-direction: column; }
.kop { display: flex; align-items: center; gap: 18px; }
.kop img { width: 58px; height: 58px; }
.kop .n { font-weight: 750; font-size: 30px; letter-spacing: .02em; color: #12357f; }
.kop .t { font-size: 20px; color: #5d5b54; margin-left: 18px; padding-left: 18px; border-left: 1px solid #c8c4be; }
.baris { flex: 1; display: flex; align-items: flex-start; justify-content: center; gap: 92px; margin-top: 64px; }
.kol { display: flex; flex-direction: column; align-items: center; gap: 30px; }
.lb { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; max-width: 430px; }
.lb b { font-size: 23px; font-weight: 650; letter-spacing: -.01em; }
.lb span { font-size: 18px; color: #5d5b54; line-height: 1.45; }
.cip { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; padding: 5px 12px 5px 6px; border-radius: 999px; color: #37352f; }
.cip i { font-style: normal; width: 26px; height: 26px; border-radius: 7px; background: #fff; display: grid; place-items: center; font-weight: 750; font-size: 14px; }
`;
const kop = (t) => `<div class="kop"><img src="${LOGO}"><span class="n">JEDA</span><span class="t">${t}</span></div>`;

await render(
  "01-mockup-utama",
  halaman(
    `<div class="papan">${kop("Latihan literasi verifikasi · Kota Bengkulu")}
    <div class="baris">
      <div class="kol" style="margin-top:70px">${ponsel("m05-beranda")}${label("Beranda", "Satu latihan per hari, kasus lokal, sekitar 10 menit")}</div>
      <div class="kol">${ponsel("m10-tombol-jeda")}${label("Tombol JEDA", "Tiga pertanyaan singkat sebelum menyalin atau mengirim")}</div>
      <div class="kol" style="margin-top:70px">${ponsel("m11-jejak-ringkas")}${label("Jejak Verifikasi", "Catatan pemeriksaan yang bisa ditunjukkan ke fasilitator")}</div>
    </div></div>`,
    1680, 1400, "#f3f1ee", cssPapan,
  ),
  1680, 1400,
);

// ---------- 3. Alur empat tahap
const tahap = [
  ["m06-pengantar", null, "Kasus", "Foto surat edaran beredar di grup orang tua"],
  ["m07b-tahap1-umpan", ["J", "#dcecfa"], "Jelajah Sumber", "Pilih tiga petunjuk asal-usul, lalu baca alasannya"],
  ["m08b-tahap2-umpan", ["E", "#d9f3e1"], "Evaluasi Bukti", "Satu sumber primer dan satu pembanding independen"],
  ["m09b-tahap3-umpan", ["D", "#ffe8d4"], "Deteksi Manipulasi", "Kenali teknik yang dipakai pembuat klaim"],
  ["m10b-tombol-jeda-isi", ["A", "#e6e0f5"], "Ambil Sikap", "Tombol JEDA: bukti, pihak yang diuntungkan, akibat"],
  ["m11-jejak-ringkas", null, "Jejak Verifikasi", "Empat unsur: sumber, pembanding, tanggal, konteks"],
];
await render(
  "02-alur-empat-tahap",
  halaman(
    `<div class="papan" style="padding:84px 90px">${kop("Alur satu sesi latihan")}
    <div class="baris" style="gap:48px;margin-top:58px">
    ${tahap
      .map(
        ([l, t, j, s], i) =>
          `<div class="kol" style="gap:26px">${ponsel(l)}<div class="lb" style="max-width:360px">${
            t ? `<span class="cip" style="background:${t[1]}"><i>${t[0]}</i>Tahap ${"JEDA".indexOf(t[0]) + 1}</span>` : `<span class="cip" style="background:#e5e3df;padding-left:12px">${i === 0 ? "Mulai" : "Hasil"}</span>`
          }<b style="margin-top:6px">${j}</b><span>${s}</span></div></div>`,
      )
      .join("")}
    </div></div>`,
    3060, 1440, "#f3f1ee", cssPapan,
  ),
  3060, 1440,
);

// ---------- 4. Masuk dan privasi
await render(
  "03-masuk-dan-privasi",
  halaman(
    `<div class="papan">${kop("Masuk tanpa nama asli")}
    <div class="baris">
      <div class="kol">${ponsel("m01b-masuk-isi")}${label("Kode ruang + nama samaran", "Kode dibagikan fasilitator. Surel boleh dikosongkan")}</div>
      <div class="kol">${ponsel("m02-kode-pribadi")}${label("Kode pribadi", "Ditampilkan sekali, dipakai untuk masuk dari ponsel lain")}</div>
      <div class="kol">${ponsel("m03-persetujuan")}${label("Persetujuan", "Tujuan, data yang dicatat, dan siapa yang melihat")}</div>
    </div></div>`,
    1680, 1330, "#f3f1ee", cssPapan,
  ),
  1680, 1330,
);

// ---------- 5. Cek klaim dari kehidupan nyata
await render(
  "04-cek-klaim",
  halaman(
    `<div class="papan">${kop("Cek klaim yang baru masuk")}
    <div class="baris">
      <div class="kol">${ponsel("m13b-cek-isi")}${label("Tempel pesan", "Isi pesan tidak disimpan di ruang kelompok")}</div>
      <div class="kol">${ponsel("m14-cek-periksa")}${label("Catat pemeriksaan", "Sumber primer, pembanding, tanggal, konteks")}</div>
      <div class="kol">${ponsel("m15-jejak-daftar")}${label("Daftar jejak", "Titik hijau menunjukkan unsur yang sudah lengkap")}</div>
    </div></div>`,
    1680, 1330, "#f3f1ee", cssPapan,
  ),
  1680, 1330,
);

// ---------- 6. Dasbor fasilitator (jendela peramban sederhana + ponsel)
const jendela = (layar, lebar) => `<div style="width:${lebar}px;border-radius:14px;overflow:hidden;background:#fff;flex:none;
  box-shadow:0 0 0 1px rgba(0,0,0,.08),0 40px 60px -30px rgba(15,25,50,.35),0 18px 24px -18px rgba(15,25,50,.2)">
  <div style="height:44px;background:#ecebe8;display:flex;align-items:center;gap:8px;padding:0 18px;border-bottom:1px solid #dcdad5">
  <i style="width:12px;height:12px;border-radius:50%;background:#d6d3ce"></i><i style="width:12px;height:12px;border-radius:50%;background:#d6d3ce"></i><i style="width:12px;height:12px;border-radius:50%;background:#d6d3ce"></i>
  <span style="margin-left:22px;flex:1;max-width:460px;height:26px;border-radius:7px;background:#fff;font-size:14px;color:#6f6d66;display:flex;align-items:center;padding-left:12px">jeda.onrender.com/dasbor</span></div>
  <img src="${LAYAR(layar)}" style="display:block;width:100%"></div>`;
await render(
  "05-dasbor-fasilitator",
  halaman(
    `<div class="papan">${kop("Dasbor fasilitator: angka gabungan, k ≥ 5")}
    <div class="baris" style="align-items:flex-start;gap:0;margin-top:56px;position:relative">
      <div class="kol">${jendela("d01-dasbor", 1340)}${label("Dasbor fasilitator", "K1 sampai K3 dan metrik pendukung. Kelompok di bawah lima orang tidak ditampilkan")}</div>
    </div></div>`,
    1680, 1220, "#f3f1ee", cssPapan,
  ),
  1680, 1220,
);

await browser.close();
console.log("selesai");
