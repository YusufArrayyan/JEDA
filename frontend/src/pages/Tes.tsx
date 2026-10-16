import { ArrowLeft, ArrowRight, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Back, ErrorNote, Note, PageTitle, Simulasi } from "../components/ui";
import { api } from "../lib/api";
import { labelOpsi, useApp } from "../lib/app";

interface Butir {
  id: string;
  klaim: string;
  konteks: string;
}
type Jawab = Record<string, { label?: string; niat?: number }>;

export default function Tes() {
  const { tipe = "awal" } = useParams<{ tipe: "awal" | "akhir" }>();
  const { konfig, muatUlang, profil } = useApp();
  const [butir, setButir] = useState<Butir[] | null>(null);
  const [selesai, setSelesai] = useState<{ skor_akurasi: number; skor_niat_berbagi: number } | null>(null);
  const [pembahasan, setPembahasan] = useState<Record<string, { label: string; penjelasan: string }> | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const [i, setI] = useState(-1);
  const kunci = `jeda.tes.${tipe}`;
  const [jawab, setJawab] = useState<Jawab>(() => {
    try {
      return JSON.parse(localStorage.getItem(kunci) || "{}");
    } catch {
      return {};
    }
  });
  const [coba, setCoba] = useState(false);
  const [kirim, setKirim] = useState(false);

  useEffect(() => {
    api<{ selesai: boolean; butir?: Butir[]; hasil?: { skor_akurasi: number; skor_niat_berbagi: number } }>(`/api/tes/${tipe}`)
      .then((r) => (r.selesai ? setSelesai(r.hasil!) : setButir(r.butir!)))
      .catch(setGalat);
  }, [tipe]);

  useEffect(() => {
    localStorage.setItem(kunci, JSON.stringify(jawab));
  }, [jawab, kunci]);

  async function kirimTes() {
    setKirim(true);
    try {
      const r = await api<{ skor_akurasi: number; skor_niat_berbagi: number; pembahasan: typeof pembahasan }>(`/api/tes/${tipe}`, { method: "POST", body: { jawaban: jawab } });
      localStorage.removeItem(kunci);
      setSelesai(r);
      setPembahasan(r.pembahasan);
      void muatUlang();
    } catch (e) {
      setGalat(e);
    } finally {
      setKirim(false);
    }
  }

  const judul = tipe === "awal" ? "Tes awal" : "Tes akhir";

  if (selesai) {
    const awal = profil?.tes.awal;
    return (
      <div className="stack-lg">
        <Back to="/" label="Beranda" />
        <span className="badge ok">Tes selesai</span>
        <PageTitle sub="Hasil ini hanya terlihat olehmu. Tidak ada papan peringkat.">{`${judul}: hasilmu`}</PageTitle>
        <div className="grid-2">
          <div className="card kpi">
            <span className="caption">Akurasi membedakan konten</span>
            <span className="angka">{Math.round(selesai.skor_akurasi)}%</span>
            {tipe === "akhir" && awal && <span className="caption">Tes awal: {Math.round(awal.skor_akurasi)}%</span>}
          </div>
          <div className="card kpi">
            <span className="caption">Niat meneruskan info belum terverifikasi</span>
            <span className="angka">{selesai.skor_niat_berbagi.toFixed(1)}</span>
            <span className="caption">skala 1–5, makin rendah makin hati-hati{tipe === "akhir" && awal ? ` · awal ${awal.skor_niat_berbagi.toFixed(1)}` : ""}</span>
          </div>
        </div>
        {pembahasan && butir && (
          <section className="stack-sm" aria-labelledby="bahas">
            <h2 id="bahas">Pembahasan</h2>
            {butir.map((b, k) => (
              <div key={b.id} className="card tight stack-sm">
                <p className="caption">Butir {k + 1}</p>
                <p style={{ color: "var(--ink)" }}>{b.klaim}</p>
                <p className="small">
                  <span className={`badge ${jawab[b.id]?.label === pembahasan[b.id].label ? "ok" : "warn"}`}>{labelOpsi(konfig?.label_asesmen, pembahasan[b.id].label)}</span>{" "}
                  {pembahasan[b.id].penjelasan}
                </p>
              </div>
            ))}
          </section>
        )}
        {tipe === "akhir" && !profil?.sus_selesai && (
          <Link to="/survei" className="btn primary block">
            Isi survei singkat (2 menit)
          </Link>
        )}
        <Link to="/" className="btn secondary block">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  if (galat && !butir) {
    return (
      <div className="stack-lg">
        <Back to="/" label="Beranda" />
        <PageTitle>{judul}</PageTitle>
        <ErrorNote error={galat} />
      </div>
    );
  }
  if (!butir) return <p className="muted" role="status">Memuat tes…</p>;

  if (i < 0) {
    return (
      <div className="stack-lg">
        <Back to="/" label="Beranda" />
        <PageTitle sub="Bentuk tes awal dan akhir sama, dengan contoh berbeda, agar kemajuanmu bisa dibandingkan.">{judul}</PageTitle>
        <div className="card stack-sm">
          <div className="row">
            <ClipboardList aria-hidden style={{ color: "var(--brand)" }} />
            <b style={{ color: "var(--ink)" }}>{butir.length} butir · sekitar 6 menit</b>
          </div>
          <p className="small muted">Untuk setiap klaim, pilih jenisnya, lalu nyatakan seberapa ingin kamu meneruskannya. Tidak ada jawaban yang dinilai di depan teman.</p>
        </div>
        <div className="stack-sm">
          {konfig?.label_asesmen.map((l) => (
            <div key={l.kode} className="row" style={{ alignItems: "flex-start" }}>
              <span className="badge" style={{ minWidth: 110, justifyContent: "center" }}>
                {l.label}
              </span>
              <span className="small muted">{l.keterangan}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn primary block" onClick={() => setI(0)}>
          Mulai tes
        </button>
      </div>
    );
  }

  const b = butir[i];
  const j = jawab[b.id] ?? {};
  const lengkap = !!j.label && !!j.niat;
  const terakhir = i === butir.length - 1;
  const belum = butir.filter((x) => !jawab[x.id]?.label || !jawab[x.id]?.niat).length;

  return (
    <div className="stack-lg">
      <div>
        <div className="stagebar" style={{ gridTemplateColumns: `repeat(${butir.length}, 1fr)` }} role="progressbar" aria-valuemin={1} aria-valuemax={butir.length} aria-valuenow={i + 1} aria-label={`Butir ${i + 1} dari ${butir.length}`}>
          {butir.map((x, k) => (
            <span key={x.id} className={k < i ? "done" : k === i ? "now" : ""} />
          ))}
        </div>
        <p className="stage-label">
          {judul} · butir {i + 1} dari {butir.length}
        </p>
      </div>
      <h1 tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })} key={b.id} style={{ fontSize: 22 }}>
        Klaim ini termasuk jenis apa?
      </h1>
      <Simulasi format="unggahan">
        {b.klaim}
        <span className="caption" style={{ display: "block", marginTop: 8 }}>
          {b.konteks}
        </span>
      </Simulasi>
      <fieldset>
        <legend>Penilaianmu</legend>
        <div className="grid-2">
          {konfig?.label_asesmen.map((l) => (
            <label key={l.kode} className="choice compact">
              <input type="radio" name={`l-${b.id}`} checked={j.label === l.kode} onChange={() => setJawab((x) => ({ ...x, [b.id]: { ...x[b.id], label: l.kode } }))} />
              <span className="t">{l.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Seberapa ingin kamu meneruskannya?</legend>
        <div className="scale">
          {konfig?.jeda.niat.map((n) => (
            <label key={n.nilai}>
              <input type="radio" name={`n-${b.id}`} checked={j.niat === n.nilai} onChange={() => setJawab((x) => ({ ...x, [b.id]: { ...x[b.id], niat: n.nilai } }))} />
              <b>{n.nilai}</b>
              {n.label}
            </label>
          ))}
        </div>
      </fieldset>
      {coba && !lengkap && <Note tone="warn">Pilih jenis klaim dan seberapa ingin kamu meneruskannya.</Note>}
      {terakhir && belum > 0 && coba && <Note tone="warn">Masih ada {belum} butir yang belum lengkap. Kembali ke butir itu untuk melengkapinya.</Note>}
      <ErrorNote error={galat} />
      <div className="row">
        <button type="button" className="btn secondary" onClick={() => setI(i - 1)} disabled={i === 0}>
          <ArrowLeft aria-hidden /> Kembali
        </button>
        <button
          type="button"
          className="btn primary"
          style={{ flex: 1 }}
          disabled={kirim}
          onClick={() => {
            setCoba(true);
            if (!lengkap) return;
            if (!terakhir) {
              setCoba(false);
              setI(i + 1);
              window.scrollTo({ top: 0 });
            } else if (belum === 0) void kirimTes();
          }}
        >
          {terakhir ? (kirim ? "Mengirim…" : "Kirim jawaban") : "Lanjut"} {!terakhir && <ArrowRight aria-hidden />}
        </button>
      </div>
    </div>
  );
}
