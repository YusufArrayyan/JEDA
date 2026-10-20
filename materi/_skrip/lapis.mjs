// Merender lapisan PNG 1920x1080 untuk video: latar per kalimat, bingkai ponsel/jendela (varian putih & hitam untuk matting), kartu pembuka dan penutup.
//   node materi/_skrip/lapis.mjs
import { chromium } from "../../frontend/node_modules/playwright-core/index.mjs";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const akar = (p) => fileURLToPath(new URL(p, import.meta.url));
const url = (p) => pathToFileURL(akar(p)).href;
const OUT = akar("../_kerja/lapis/");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const FONT = url("../../frontend/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const LOGO = url("../_kerja/logo-crop.png");
const KAL = JSON.parse(readFileSync(akar("../_kerja/suara/kalimat.json"), "utf8"));
// Teks di layar memakai ejaan tulis, bukan ejaan lisan untuk TTS.
for (const daftar of Object.values(KAL)) for (const k of daftar) k.teks = k.teks.replace("jeda titik onrender titik com", "jeda.onrender.com");

export const ADEGAN = {
  s02: ["Masuk", null, "Kode ruang dan nama samaran", 0],
  s03: ["Masuk", null, "Kode pribadi dan persetujuan", 0],
  s04: ["Tes awal", null, "Titik berangkat", 1],
  s05: ["Beranda", null, "Satu kasus lokal tiap hari", 2],
  s06: ["Tahap 1", ["J", "#dcecfa"], "Jelajah Sumber", 2],
  s07: ["Tahap 2", ["E", "#d9f3e1"], "Evaluasi Bukti", 2],
  s08: ["Tahap 3", ["D", "#ffe8d4"], "Deteksi Manipulasi", 2],
  s09: ["Tahap 4", ["A", "#e6e0f5"], "Ambil Sikap", 2],
  s10: ["Hasil", null, "Jejak Verifikasi", 3],
  s11: ["Cek", null, "Cek klaim dari luar latihan", 4],
  s12: ["Ruang", null, "Bank kasus dan studio kartu", 5],
  s13: ["Tim program", null, "Dasbor fasilitator", 6],
};
const LANGKAH = ["Masuk", "Tes awal", "Latihan", "Jejak", "Cek", "Ruang", "Dasbor"];

const css = `
@font-face { font-family: Inter; src: url(${FONT}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1920px; height: 1080px; overflow: hidden; }
body { font-family: Inter, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; position: relative; }
.latar { background: #f3f1ee; }
.kop { position: absolute; left: 140px; top: 84px; display: flex; align-items: center; gap: 14px; }
.kop img { width: 44px; height: 44px; } .kop span { font-weight: 750; font-size: 24px; letter-spacing: .02em; color: #12357f; }
.panel { position: absolute; left: 140px; width: 860px; top: 250px; height: 600px; display: flex; flex-direction: column; justify-content: center; }
.cip { align-self: flex-start; display: inline-flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 600; padding: 7px 18px 7px 8px; border-radius: 999px; color: #37352f; background: #e5e3df; }
.cip.polos { padding-left: 18px; }
.cip i { font-style: normal; width: 34px; height: 34px; border-radius: 9px; background: #fff; display: grid; place-items: center; font-weight: 750; font-size: 18px; }
h1 { font-size: 68px; line-height: 1.08; letter-spacing: -.025em; font-weight: 720; margin-top: 26px; }
.kal { margin-top: 34px; font-size: 34px; line-height: 1.42; color: #4a4843; max-width: 820px; text-wrap: pretty; }
.langkah { position: absolute; left: 140px; bottom: 86px; display: flex; gap: 8px; font-size: 19px; color: #8a877f; }
.langkah b { color: #12357f; font-weight: 650; }
.langkah s { text-decoration: none; color: #c8c4be; }
.hp { position: absolute; width: 418px; padding: 13px; border-radius: 64px; background: #1b1c1f;
  box-shadow: inset 0 0 0 2px #3a3c41, 0 1px 0 1px #0d0e10, 0 40px 60px -30px rgba(15, 25, 50, .35), 0 18px 24px -18px rgba(15, 25, 50, .25); }
.hp::before, .hp::after { content: ""; position: absolute; width: 4px; background: #2a2c30; border-radius: 2px; }
.hp::before { left: -3px; top: 180px; height: 64px; box-shadow: 0 84px 0 #2a2c30; }
.hp::after { right: -3px; top: 220px; height: 96px; }
.scr { width: 392px; height: 915px; border-radius: 52px; overflow: hidden; position: relative; display: flex; flex-direction: column; }
.sb { height: 49px; flex: none; background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 6px 30px 0 40px; font-weight: 600; font-size: 16px; }
.lubang { flex: 1; }
.bawah { height: 18px; flex: none; background: #fff; }
.isl { position: absolute; top: 11px; left: 50%; transform: translateX(-50%); width: 122px; height: 35px; border-radius: 20px; background: #000; }
.home { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); width: 136px; height: 5px; border-radius: 3px; background: #1a1a1a; }
.jendela { position: absolute; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 40px 60px -30px rgba(15,25,50,.35), 0 18px 24px -18px rgba(15,25,50,.2); }
.jendela .bar { height: 40px; flex: none; background: #ecebe8; display: flex; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid #dcdad5; }
.jendela .bar i { width: 12px; height: 12px; border-radius: 50%; background: #d6d3ce; }
.jendela .bar span { margin-left: 20px; width: 420px; height: 24px; border-radius: 7px; background: #fff; font-size: 13px; color: #6f6d66; display: flex; align-items: center; padding-left: 12px; }
`;
const ikonSb = `<span style="display:flex;gap:6px;align-items:center">
<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#111"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#111"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z M3.4 6.8a6.6 6.6 0 0 1 9.2 0l-1.2 1.2a4.9 4.9 0 0 0-6.8 0Z M1.2 4.6a9.7 9.7 0 0 1 13.6 0l-1.1 1.1a8.2 8.2 0 0 0-11.4 0Z" fill="#111"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#111" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#111"/><rect x="25" y="4.5" width="1.6" height="4" rx=".8" fill="#111" opacity=".4"/></svg></span>`;

// Posisi ponsel di bingkai 1920x1080. Video layar diletakkan di (HP_X+13, HP_Y+13+49), ukuran 392x848.
export const HP_X = 1170, HP_Y = 70;
// Jendela laptop: konten 1440x900 diskala 0.8 -> 1152x720.
export const JD_X = 600, JD_Y = 160, JD_W = 1280, JD_H = 800;

const ponsel = (isiLubang = "", latarLayar = "transparent", x = HP_X, y = HP_Y) =>
  `<div class="hp" style="left:${x}px;top:${y}px"><div class="scr" style="background:${latarLayar}"><div class="sb"><span>09.41</span>${ikonSb}</div><div class="lubang">${isiLubang}</div><div class="bawah"></div><div class="isl"></div><div class="home"></div></div></div>`;
const jendela = (latar) =>
  `<div class="jendela" style="left:${JD_X}px;top:${JD_Y - 40}px;width:${JD_W}px;height:${JD_H + 40}px;background:${latar}"><div class="bar"><i></i><i></i><i></i><span>jeda.onrender.com/dasbor</span></div><div style="flex:1"></div></div>`;
const langkah = (aktif) =>
  `<div class="langkah">${LANGKAH.map((l, i) => (i === aktif ? `<b>${l}</b>` : `<span>${l}</span>`)).join("<s>·</s>")}</div>`;
const kop = `<div class="kop"><img src="${LOGO}"><span>JEDA</span></div>`;
const cip = (label, t) => (t ? `<span class="cip" style="background:${t[1]}"><i>${t[0]}</i>${label}</span>` : `<span class="cip polos">${label}</span>`);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
async function render(nama, isi, transparan = false, kelasBody = "latar") {
  const f = `${OUT}_${nama}.html`;
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="${transparan ? "" : kelasBody}">${isi}</body></html>`);
  await p.goto(pathToFileURL(f).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete));
  await p.screenshot({ path: `${OUT}${nama}.png`, omitBackground: transparan });
}

// Latar adegan ponsel: satu gambar per kalimat narasi.
for (const [k, [label, t, judul, aktif]] of Object.entries(ADEGAN)) {
  const desktop = k === "s13";
  for (const [j, kal] of KAL[k].entries()) {
    const panel = desktop
      ? `<div class="panel" style="width:400px;top:200px">${cip(label, t)}<h1 style="font-size:50px">${judul}</h1><p class="kal" style="font-size:27px">${kal.teks}</p></div>`
      : `<div class="panel">${cip(label, t)}<h1>${judul}</h1><p class="kal">${kal.teks}</p></div>`;
    await render(`${k}-${j}`, kop + panel + langkah(aktif));
  }
}
// Bingkai ponsel & jendela, varian layar putih dan hitam (untuk menghitung alfa).
await render("ponsel-putih", ponsel("", "#ffffff"), true);
await render("ponsel-hitam", ponsel("", "#000000"), true);
await render("jendela-putih", jendela("#ffffff"), true);
await render("jendela-hitam", jendela("#000000"), true);

// Kartu pembuka (s01) dan penutup (s14), juga per kalimat.
const layarMasuk = `<img src="${url("../_kerja/layar/m01-masuk.png")}" style="display:block;width:392px">`;
for (const [j, kal] of KAL.s01.entries()) {
  await render(
    `s01-${j}`,
    `<div class="panel" style="top:200px;height:680px">
      <div style="display:flex;align-items:center;gap:22px"><img src="${LOGO}" style="width:92px;height:92px"><span style="font-weight:760;font-size:56px;letter-spacing:.02em;color:#12357f">JEDA</span></div>
      <h1 style="font-size:76px;margin-top:44px">Berhenti sebentar,<br>periksa dulu.</h1>
      <p class="kal" style="margin-top:38px">${kal.teks}</p></div>` + ponsel(layarMasuk, "#fff"),
  );
}
for (const [j, kal] of KAL.s14.entries()) {
  await render(
    `s14-${j}`,
    `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <img src="${LOGO}" style="width:120px;height:120px">
      <p style="margin-top:44px;font-size:42px;line-height:1.35;color:#37352f;max-width:1100px;min-height:120px;text-wrap:balance">${kal.teks}</p>
      <div style="margin-top:56px;display:flex;gap:18px;align-items:stretch">
        <div style="background:#fff;border:1px solid #e5e3df;border-radius:16px;padding:22px 34px;text-align:left"><div style="font-size:18px;color:#6f6d66">Alamat</div><div style="font-size:32px;font-weight:650;margin-top:6px">jeda.onrender.com</div></div>
        <div style="background:#fff;border:1px solid #e5e3df;border-radius:16px;padding:22px 34px;text-align:left"><div style="font-size:18px;color:#6f6d66">Kode ruang demo</div><div style="font-size:32px;font-weight:650;margin-top:6px;font-family:ui-monospace,Consolas,monospace;letter-spacing:.06em">JD-07-BKL</div></div>
      </div></div>`,
  );
}
await browser.close();
console.log("lapis selesai");
