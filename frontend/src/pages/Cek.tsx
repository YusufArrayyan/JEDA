import { ArrowRight, ExternalLink, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { TombolJeda } from "../components/TombolJeda";
import { Back, ErrorNote, Field, Note, PageTitle, useJagaIsian } from "../components/ui";
import { useApp } from "../lib/app";
import { hariIni, kelengkapan, kirim, uuid } from "../lib/offline";
import type { Jejak, Keputusan } from "../lib/types";
import { cariUrl, simpanJejakLokal } from "./LatihanSesi";

const LANGKAH = [
  { n: 1, judul: "Jelajah Sumber", isi: "Siapa pembuatnya, kapan pertama kali diunggah, dan apakah ada kanal resmi yang bisa kamu buka sendiri?", tint: "tint-j" },
  { n: 2, judul: "Evaluasi Bukti", isi: "Cari klaim ini di dua sumber independen. Catat sumber primer, tanggal, dan konteksnya.", tint: "tint-e" },
  { n: 3, judul: "Deteksi Manipulasi", isi: "Cek judul provokatif, otoritas palsu, potongan konteks, serta gambar atau suara yang janggal.", tint: "tint-d" },
  { n: 4, judul: "Ambil Sikap", isi: "Jawab tiga pertanyaan di Tombol JEDA, lalu pilih tindakanmu.", tint: "tint-a" },
];

const KATA_UMUM = new Set("yang dan di ke dari ini itu untuk dengan pada akan sudah agar atau juga kamu kami kita anda tidak ada bisa jadi hari klik lewat via segera sekarang".split(" "));

/** Saran kata kunci sederhana dari teks klaim. Sistem hanya menyarankan, tidak memvonis (PRD 4.1). */
function saranKataKunci(teks: string): string[] {
  const url = teks.match(/(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/\S*)?/i)?.[1];
  const kata = teks
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !KATA_UMUM.has(w.toLowerCase()));
  const inti = kata.slice(0, 6).join(" ");
  const out = [];
  if (inti) out.push(`"${kata.slice(0, 5).join(" ")}"`, `${inti} cek fakta`);
  if (url) out.push(`${url} penipuan`);
  return out.slice(0, 3);
}

type Langkah = "tempel" | "periksa" | "jeda";

export default function Cek() {
  const { konfig, toast } = useApp();
  const nav = useNavigate();
  const maks = konfig?.cek_maks ?? 1000;
  const [langkah, setLangkah] = useState<Langkah>("tempel");
  const [teks, setTeks] = useState("");
  const [galatTeks, setGalatTeks] = useState<string | null>(null);
  const [sesiId, setSesiId] = useState<string | null>(null);
  const [f, setF] = useState({ sumber_primer: "", sumber_primer_url: "", pembanding: "", pembanding_url: "", tanggal_periksa: hariIni(), konteks: "" });
  const [simpanKlaim, setSimpanKlaim] = useState(false);
  const [galat, setGalat] = useState<unknown>(null);
  const kunci = useMemo(() => saranKataKunci(teks), [teks]);
  const kel = kelengkapan(f);
  const lepas = useJagaIsian(teks.trim().length > 0);

  async function mulai() {
    if (!teks.trim()) {
      setGalatTeks("Tempel pesan atau tautan yang mau kamu periksa.");
      document.getElementById("klaim")?.focus();
      return;
    }
    if (teks.length > maks) {
      setGalatTeks(`Teks terlalu panjang. Potong menjadi ${maks.toLocaleString("id-ID")} karakter atau kurang.`);
      return;
    }
    setGalatTeks(null);
    const id = uuid();
    try {
      await kirim("PUT", "/api/sesi", { id, mode: "cek", mulai: new Date().toISOString() });
      setSesiId(id);
      setLangkah("periksa");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setGalat(e);
    }
  }

  async function selesai(k: Keputusan) {
    if (!sesiId) return;
    const now = new Date().toISOString();
    const id = uuid();
    try {
      await kirim("POST", `/api/sesi/${sesiId}/jeda`, { ...k, diperbarui_pada: now });
      const body = { id, sesi_id: sesiId, klaim: simpanKlaim ? teks.trim() : "", ...f, tanggal_periksa: f.tanggal_periksa || null, diperbarui_pada: now };
      const r = await kirim<Jejak>("PUT", "/api/jejak", body);
      simpanJejakLokal(r ?? { ...body, mode: "cek", tindakan: k.tindakan, catatan: "", kelengkapan: kel.nilai, kurang: kel.kurang, dibuat_pada: now, diperbarui_pada: now, antre: true } as Jejak);
      lepas();
      toast(r ? "Jejak tersimpan." : "Jejak tersimpan di perangkat dan akan terkirim saat sinyal kembali.");
      nav(`/jejak/${id}`);
    } catch (e) {
      setGalat(e);
    }
  }

  const disclaimer = (
    <Note icon={<ShieldAlert aria-hidden />}>
      <b>JEDA tidak memberi vonis benar atau salah.</b> Alat deteksi otomatis hanya petunjuk tambahan. Kamu yang memeriksa, kami yang memandu.
    </Note>
  );

  if (langkah === "jeda" && sesiId) {
    return (
      <div className="stack-lg">
        <Back onClick={() => setLangkah("periksa")} />
        <TombolJeda sesiId={sesiId} tombol="Simpan jejak" onSelesai={selesai} />
        <ErrorNote error={galat} />
      </div>
    );
  }

  if (langkah === "periksa") {
    const up = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
    return (
      <div className="stack-lg">
        <Back onClick={() => setLangkah("tempel")} />
        <PageTitle sub="Ikuti empat langkah ini. Catat yang kamu temukan; boleh dikosongkan bila belum ketemu.">Periksa klaimmu</PageTitle>
        <blockquote className="sim" style={{ margin: 0 }}>
          {teks}
        </blockquote>
        {kunci.length > 0 && (
          <div className="card soft stack-sm">
            <span className="caption">Kata kunci yang disarankan</span>
            <div className="chips">
              {kunci.map((k) => (
                <a key={k} className="kw" href={cariUrl(k)} target="_blank" rel="noopener noreferrer">
                  {k} <ExternalLink aria-hidden />
                  <span className="sr-only">(buka pencarian di tab baru)</span>
                </a>
              ))}
            </div>
            <p className="caption">Pencarian dibuka di tab baru. Isi pesanmu tidak dikirim ke layanan JEDA.</p>
          </div>
        )}
        <div className="stack-sm">
          {LANGKAH.slice(0, 3).map((l) => (
            <div key={l.n} className={`card tight ${l.tint}`} style={{ border: 0 }}>
              <h3>
                {l.n}. {l.judul}
              </h3>
              <p className="small" style={{ marginTop: 4 }}>
                {l.isi}
              </p>
            </div>
          ))}
        </div>
        <section className="card stack" aria-labelledby="catat">
          <h2 id="catat">Catat temuanmu</h2>
          <Field label="Sumber primer" htmlFor="sp" help="Misalnya situs atau akun resmi lembaga yang disebut dalam pesan.">
            <input id="sp" className="input" value={f.sumber_primer} onChange={up("sumber_primer")} maxLength={400} />
          </Field>
          <Field label="Tautan sumber primer (opsional)" htmlFor="spu">
            <input id="spu" className="input" type="url" inputMode="url" value={f.sumber_primer_url} onChange={up("sumber_primer_url")} maxLength={400} placeholder="https://…" />
          </Field>
          <Field label="Pembanding independen" htmlFor="pb" help="Sumber lain yang tidak terkait penyebar, misalnya situs pemeriksa fakta.">
            <input id="pb" className="input" value={f.pembanding} onChange={up("pembanding")} maxLength={400} />
          </Field>
          <Field label="Tautan pembanding (opsional)" htmlFor="pbu">
            <input id="pbu" className="input" type="url" inputMode="url" value={f.pembanding_url} onChange={up("pembanding_url")} maxLength={400} placeholder="https://…" />
          </Field>
          <Field label="Tanggal pemeriksaan" htmlFor="tg">
            <input id="tg" className="input" type="date" value={f.tanggal_periksa} onChange={up("tanggal_periksa")} />
          </Field>
          <Field label="Konteks klaim" htmlFor="kt" help="Di mana dan sejak kapan pesan ini beredar.">
            <textarea id="kt" className="textarea" style={{ minHeight: 88 }} value={f.konteks} onChange={up("konteks")} maxLength={600} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={simpanKlaim} onChange={(e) => setSimpanKlaim(e.target.checked)} />
            <span>
              Simpan teks klaim di jejakku
              <span className="caption" style={{ display: "block" }}>
                Bila tidak dicentang, isi pesan tidak disimpan sama sekali. Jejak tetap tersimpan tanpa teks klaim.
              </span>
            </span>
          </label>
          <p className="caption">Kelengkapan saat ini: {kel.nilai} dari 4 unsur.</p>
        </section>
        {disclaimer}
        <button type="button" className="btn primary block" onClick={() => setLangkah("jeda")}>
          Lanjut ke Tombol JEDA <ArrowRight aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <PageTitle sub="Tempel pesan atau tautan yang mau kamu teruskan. Kamu yang memeriksa, kami yang memandu.">Cek klaim</PageTitle>
      <Field label="Klaim yang mau diperiksa" htmlFor="klaim" error={galatTeks}>
        <textarea
          id="klaim"
          className="textarea"
          value={teks}
          onChange={(e) => {
            setTeks(e.target.value);
            if (galatTeks) setGalatTeks(null);
          }}
          aria-invalid={!!galatTeks}
          aria-describedby={`klaim-hitung${galatTeks ? " klaim-err" : ""}`}
        />
      </Field>
      <div className="row between" style={{ marginTop: -18 }}>
        <span className="caption">JEDA tidak menyimpan isi pesanmu di ruang kelompok.</span>
        <span id="klaim-hitung" className={`counter ${teks.length > maks ? "over" : ""}`}>
          {teks.length.toLocaleString("id-ID")}/{maks.toLocaleString("id-ID")}
        </span>
      </div>
      <div className="stack-sm">
        {LANGKAH.map((l) => (
          <div key={l.n} className={`card tight ${l.tint}`} style={{ border: 0 }}>
            <h3>
              {l.n}. {l.judul}
            </h3>
            <p className="small" style={{ marginTop: 4 }}>
              {l.isi}
            </p>
          </div>
        ))}
      </div>
      {disclaimer}
      <ErrorNote error={galat} />
      <button type="button" className="btn primary block" onClick={mulai}>
        Mulai memeriksa
      </button>
    </div>
  );
}
