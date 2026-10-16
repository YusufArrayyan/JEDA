import { ArrowRight, Clock, ExternalLink, Layers, ShieldCheck, TriangleAlert, X, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TombolJeda } from "../components/TombolJeda";
import { Back, ErrorNote, Note, PageTitle, Simulasi, StageBar, UnsurChips } from "../components/ui";
import { api, NetError } from "../lib/api";
import { labelOpsi, namaTema, namaTeknik, tgl, useApp } from "../lib/app";
import { ambilKasus, hariIni, jejakDariLatihan, kelengkapan, kirim, sesiLokal, simpanSesi, uuid, type SesiLokal } from "../lib/offline";
import type { Jejak, Kasus, Keputusan } from "../lib/types";

const NAMA_TAHAP = ["", "Jelajah Sumber", "Evaluasi Bukti", "Deteksi Manipulasi", "Ambil Sikap"];
const JENIS_LABEL = { primer: "Sumber primer", independen: "Pembanding independen", bukan_independen: "Bukan independen", bukan_sumber: "Bukan sumber" } as const;

export function cariUrl(q: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(q.replace(/["“”]/g, '"'))}`;
}

export function simpanJejakLokal(j: Jejak) {
  try {
    localStorage.setItem(`jeda.jejak.${j.id}`, JSON.stringify(j));
  } catch {
    /* abaikan */
  }
}

export default function LatihanSesi() {
  const { kasusId, sesiId } = useParams();
  const nav = useNavigate();
  const { toast, konfig } = useApp();
  const [kasus, setKasus] = useState<Kasus | null>(null);
  const [sesi, setSesi] = useState<SesiLokal | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const mulaiTahap = useRef(Date.now());

  useEffect(() => {
    if (!kasusId) return;
    ambilKasus(kasusId).then(setKasus).catch(setGalat);
  }, [kasusId]);

  // Muat sesi: dari perangkat dulu, lalu dari server bila perangkat tidak punya (FR-2.7).
  useEffect(() => {
    if (!sesiId) return;
    const lokal = sesiLokal(sesiId);
    if (lokal) {
      setSesi(lokal);
      return;
    }
    api<{ id: string; kasus_id: string; mulai: string; tahap_terakhir: number; selesai: string | null; jawaban: Record<string, { jawaban: never }>; keputusan: Keputusan | null; jejak_id: string | null }>(`/api/sesi/${sesiId}`)
      .then((s) => {
        const b: SesiLokal = {
          id: s.id,
          kasus_id: s.kasus_id,
          mode: "latihan",
          mulai: s.mulai,
          tahap: s.jejak_id ? 5 : s.selesai ? 5 : Math.min(s.tahap_terakhir + 1, 4),
          jawaban: { 1: s.jawaban["1"]?.jawaban, 2: s.jawaban["2"]?.jawaban, 3: s.jawaban["3"]?.jawaban },
          diperiksa: { 1: !!s.jawaban["1"], 2: !!s.jawaban["2"], 3: !!s.jawaban["3"] },
          durasi: {},
          keputusan: s.keputusan,
          selesai: s.selesai,
          jejak_id: s.jejak_id,
          diperbarui: new Date().toISOString(),
        };
        simpanSesi(b);
        setSesi(b);
      })
      .catch(setGalat);
  }, [sesiId]);

  const ubah = useCallback((fn: (s: SesiLokal) => SesiLokal) => {
    setSesi((s) => {
      if (!s) return s;
      const b = fn(s);
      simpanSesi(b);
      return b;
    });
  }, []);

  useEffect(() => {
    mulaiTahap.current = Date.now();
    window.scrollTo({ top: 0 });
  }, [sesi?.tahap]);

  async function mulai() {
    if (!kasus) return;
    const id = uuid();
    const s: SesiLokal = { id, kasus_id: kasus.id, mode: "latihan", mulai: new Date().toISOString(), tahap: 1, jawaban: {}, diperiksa: {}, durasi: {}, keputusan: null, selesai: null, jejak_id: null, diperbarui: "" };
    try {
      await kirim("PUT", "/api/sesi", { id, kasus_id: kasus.id, mode: "latihan", mulai: s.mulai });
      simpanSesi(s);
      nav(`/latihan/${kasus.id}/${id}`, { replace: true });
    } catch (e) {
      setGalat(e);
    }
  }

  function periksa(t: 1 | 2 | 3) {
    if (!sesi) return;
    const durasi = Math.round((Date.now() - mulaiTahap.current) / 1000) + (sesi.durasi[t] ?? 0);
    ubah((s) => ({ ...s, diperiksa: { ...s.diperiksa, [t]: true }, durasi: { ...s.durasi, [t]: durasi } }));
    void kirim("PUT", `/api/sesi/${sesi.id}/tahap/${t}`, { jawaban: sesi.jawaban[t], durasi_s: durasi, diperbarui_pada: new Date().toISOString() }).catch(setGalat);
  }

  function keTahap(t: number) {
    ubah((s) => ({ ...s, tahap: t }));
  }

  if (galat && !kasus) {
    return (
      <div className="stack">
        <Back to="/latihan" />
        <ErrorNote error={galat instanceof NetError ? new Error("Kasus ini belum tersimpan di perangkat. Sambungkan internet sekali untuk mengunduhnya.") : galat} />
      </div>
    );
  }
  if (!kasus) return <p className="muted" role="status">Memuat kasus…</p>;

  // ---------------------------------------------------------------- pengantar (FR-2.1)
  if (!sesiId) {
    return (
      <div className="stack-lg">
        <Back to="/latihan" />
        <div className="stack-sm">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge brand">Kasus lokal</span>
            <span className="badge">{namaTema(konfig, kasus.tema)}</span>
          </div>
          <PageTitle sub={kasus.ringkasan}>{kasus.judul}</PageTitle>
        </div>
        <div className="grid-2">
          <div className="card tight row">
            <Clock aria-hidden style={{ color: "var(--brand)" }} />
            <div>
              <b style={{ color: "var(--ink)" }}>± 10 menit</b>
              <p className="caption">Bisa dilanjutkan nanti</p>
            </div>
          </div>
          <div className="card tight row">
            <Layers aria-hidden style={{ color: "var(--brand)" }} />
            <div>
              <b style={{ color: "var(--ink)" }}>4 tahap</b>
              <p className="caption">J · E · D · A</p>
            </div>
          </div>
        </div>
        <Simulasi format={kasus.format}>{kasus.klaim}</Simulasi>
        <Note icon={<ShieldCheck aria-hidden />}>Kasus ini sudah diperiksa pemeriksa fakta dan diberi tanda SIMULASI. Nama lembaga dan merek di dalamnya rekaan.</Note>
        <ErrorNote error={galat} />
        <button type="button" className="btn primary block" onClick={mulai}>
          Mulai latihan
        </button>
      </div>
    );
  }
  if (!sesi) return <p className="muted" role="status">Memuat latihanmu…</p>;

  const t = sesi.tahap;
  const kembali = t > 1 && t <= 4 ? () => keTahap(t - 1) : undefined;

  return (
    <div className="stack-lg">
      {t <= 4 ? <Back onClick={kembali ?? (() => nav("/latihan"))} /> : null}
      {t <= 4 && <StageBar tahap={t} label={NAMA_TAHAP[t]} />}
      {t === 1 && <Tahap1 kasus={kasus} sesi={sesi} ubah={ubah} periksa={() => periksa(1)} lanjut={() => keTahap(2)} />}
      {t === 2 && <Tahap2 kasus={kasus} sesi={sesi} ubah={ubah} periksa={() => periksa(2)} lanjut={() => keTahap(3)} />}
      {t === 3 && <Tahap3 kasus={kasus} sesi={sesi} ubah={ubah} periksa={() => periksa(3)} lanjut={() => keTahap(4)} />}
      {t === 4 && (
        <TombolJeda
          sesiId={sesi.id}
          awal={sesi.keputusan}
          tombol="Lihat jejak verifikasiku"
          onSelesai={(k) => {
            const now = new Date().toISOString();
            ubah((s) => ({ ...s, keputusan: k, selesai: s.selesai ?? now, tahap: 5 }));
            void kirim("POST", `/api/sesi/${sesi.id}/jeda`, { ...k, diperbarui_pada: now }).catch(setGalat);
          }}
        />
      )}
      {t === 5 && <Hasil kasus={kasus} sesi={sesi} ubah={ubah} keTahap={keTahap} toast={toast} />}
      <ErrorNote error={galat} />
    </div>
  );
}

type TahapProps = { kasus: Kasus; sesi: SesiLokal; ubah: (fn: (s: SesiLokal) => SesiLokal) => void; periksa: () => void; lanjut: () => void };

// ---------------------------------------------------------------- tahap 1 (FR-2.2)
function Tahap1({ kasus, sesi, ubah, periksa, lanjut }: TahapProps) {
  const pilih = sesi.jawaban[1]?.pilihan ?? [];
  const sudah = !!sesi.diperiksa[1];
  const [penuh, setPenuh] = useState(false);
  const [coba, setCoba] = useState(false);

  function toggle(id: string) {
    setPenuh(false);
    if (!pilih.includes(id) && pilih.length >= 3) {
      setPenuh(true);
      return;
    }
    const baru = pilih.includes(id) ? pilih.filter((x) => x !== id) : [...pilih, id];
    ubah((s) => ({ ...s, jawaban: { ...s.jawaban, 1: { pilihan: baru } }, diperiksa: { ...s.diperiksa, 1: false } }));
  }

  return (
    <>
      <PageTitle sub="Pilih tiga petunjuk yang membuat asal-usul klaim ini meragukan.">Siapa yang membuat klaim ini?</PageTitle>
      <Simulasi format={kasus.format}>{kasus.klaim}</Simulasi>
      <fieldset>
        <legend className="row between" style={{ width: "100%" }}>
          <span>Petunjuk asal-usul</span>
          <span className="opt" aria-live="polite">
            {pilih.length} dari 3 dipilih
          </span>
        </legend>
        <div className="stack-sm">
          {kasus.konten.petunjuk.map((p) => {
            const dipilih = pilih.includes(p.id);
            const nada = sudah && dipilih ? (p.tepat ? "ok" : "warn") : "";
            return (
              <label key={p.id} className={`choice ${nada}`}>
                <input type="checkbox" checked={dipilih} onChange={() => toggle(p.id)} />
                <span>
                  <span className="t">{p.teks}</span>
                  {sudah && dipilih && (
                    <>
                      <span className="fb">{p.tepat ? "Petunjuk yang tepat" : "Bukan petunjuk asal-usul"}</span>
                      <span className="fb-why">{p.alasan}</span>
                    </>
                  )}
                  {sudah && !dipilih && p.tepat && (
                    <>
                      <span className="fb" style={{ color: "var(--ok)" }}>Petunjuk yang terlewat</span>
                      <span className="fb-why">{p.alasan}</span>
                    </>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {penuh && <Note tone="warn">Kamu sudah memilih tiga petunjuk. Hapus centang salah satunya bila ingin mengganti.</Note>}
      {coba && pilih.length < 3 && !sudah && <Note tone="warn">Pilih {3 - pilih.length} petunjuk lagi sebelum memeriksa.</Note>}
      {sudah && (
        <Note tone="ok">
          {pilih.filter((x) => kasus.konten.petunjuk.find((p) => p.id === x)?.tepat).length} dari 3 petunjukmu tepat. Asal-usul lebih penting daripada tampilan: logo, warna, dan bahasa baku mudah ditiru.
        </Note>
      )}
      {!sudah ? (
        <button type="button" className="btn primary block" onClick={() => (pilih.length === 3 ? periksa() : setCoba(true))}>
          Periksa pilihanku
        </button>
      ) : (
        <button type="button" className="btn primary block" onClick={lanjut}>
          Lanjut ke tahap 2 <ArrowRight aria-hidden />
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------- tahap 2 (FR-2.3)
function Tahap2({ kasus, sesi, ubah, periksa, lanjut }: TahapProps) {
  const j = sesi.jawaban[2] ?? { primer: null, pembanding: [] };
  const sudah = !!sesi.diperiksa[2];
  const [coba, setCoba] = useState(false);
  const by = new Map(kasus.konten.sumber.map((s) => [s.id, s]));
  const set = (b: typeof j) => ubah((s) => ({ ...s, jawaban: { ...s.jawaban, 2: b }, diperiksa: { ...s.diperiksa, 2: false } }));
  const valid = !!j.primer && j.pembanding.length > 0;

  const umpan = (id: string, peran: "primer" | "pembanding") => {
    const s = by.get(id)!;
    const cocok = peran === "primer" ? s.jenis === "primer" : s.jenis === "independen";
    return { cocok, label: JENIS_LABEL[s.jenis], alasan: s.alasan };
  };

  return (
    <>
      <PageTitle sub="Jangan berhenti di klaimnya. Cari di sumber lain, lalu pilih satu sumber primer dan sedikitnya satu pembanding independen.">Baca menyamping</PageTitle>
      <div className="card soft stack-sm">
        <span className="caption">Kata kunci yang disarankan</span>
        <div className="chips">
          {kasus.konten.kata_kunci.map((k) => (
            <a key={k} className="kw" href={cariUrl(k)} target="_blank" rel="noopener noreferrer">
              {k} <ExternalLink aria-hidden />
              <span className="sr-only">(buka pencarian di tab baru)</span>
            </a>
          ))}
        </div>
        <p className="caption">Tautan membuka mesin pencari di tab baru. JEDA tidak mengirim jawabanmu ke sana.</p>
      </div>

      <fieldset>
        <legend>Sumber primer</legend>
        <div className="stack-sm">
          {kasus.konten.sumber.map((s) => {
            const dipilih = j.primer === s.id;
            const u = sudah && dipilih ? umpan(s.id, "primer") : null;
            return (
              <label key={s.id} className={`choice ${u ? (u.cocok ? "ok" : "warn") : ""}`}>
                <input type="radio" name="primer" checked={dipilih} onChange={() => set({ primer: s.id, pembanding: j.pembanding.filter((x) => x !== s.id) })} />
                <span>
                  <span className="t">{s.teks}</span>
                  {u && (
                    <>
                      <span className="fb">{u.cocok ? "Sumber primer" : `${u.label}, bukan sumber primer`}</span>
                      <span className="fb-why">{u.alasan}</span>
                    </>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Pembanding<span className="opt">Pilih satu atau lebih</span>
        </legend>
        <div className="stack-sm">
          {kasus.konten.sumber
            .filter((s) => s.id !== j.primer)
            .map((s) => {
              const dipilih = j.pembanding.includes(s.id);
              const u = sudah && dipilih ? umpan(s.id, "pembanding") : null;
              return (
                <label key={s.id} className={`choice ${u ? (u.cocok ? "ok" : "warn") : ""}`}>
                  <input type="checkbox" checked={dipilih} onChange={() => set({ ...j, pembanding: dipilih ? j.pembanding.filter((x) => x !== s.id) : [...j.pembanding, s.id] })} />
                  <span>
                    <span className="t">{s.teks}</span>
                    {u && (
                      <>
                        <span className="fb">{u.label}</span>
                        <span className="fb-why">{u.alasan}</span>
                      </>
                    )}
                  </span>
                </label>
              );
            })}
        </div>
      </fieldset>
      {coba && !valid && !sudah && <Note tone="warn">{!j.primer ? "Pilih satu sumber primer." : "Pilih sedikitnya satu pembanding."}</Note>}
      {sudah && (
        <Note tone={j.pembanding.some((x) => by.get(x)?.jenis === "independen") ? "ok" : "warn"}>
          {j.pembanding.some((x) => by.get(x)?.jenis === "independen")
            ? "Dua sumber independen sudah cukup: kanal resmi pihak yang disebut dan satu pembanding yang tidak terkait penyebar."
            : "Belum ada pembanding independen. Unggahan ulang atau komentar bukan sumber terpisah. Kamu boleh mengganti pilihan lalu memeriksa lagi."}{" "}
          Sistem tidak menyatakan klaim ini benar atau salah.
        </Note>
      )}
      {!sudah ? (
        <button type="button" className="btn primary block" onClick={() => (valid ? periksa() : setCoba(true))}>
          Periksa sumberku
        </button>
      ) : (
        <button type="button" className="btn primary block" onClick={lanjut}>
          Lanjut ke tahap 3 <ArrowRight aria-hidden />
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------- tahap 3 (FR-2.4)
function Tahap3({ kasus, sesi, ubah, periksa, lanjut }: TahapProps) {
  const { konfig } = useApp();
  const pilih = sesi.jawaban[3]?.teknik ?? [];
  const sudah = !!sesi.diperiksa[3];
  const [coba, setCoba] = useState(false);
  const benar = new Set(kasus.teknik);
  const toggle = (k: string) =>
    ubah((s) => ({ ...s, jawaban: { ...s.jawaban, 3: { teknik: pilih.includes(k) ? pilih.filter((x) => x !== k) : [...pilih, k] } }, diperiksa: { ...s.diperiksa, 3: false } }));
  const daftar = konfig?.teknik ?? kasus.teknik.map((k) => ({ kode: k, nama: k, deskripsi: "" }));
  const pengecoh = daftar.length - benar.size;

  return (
    <>
      <PageTitle sub={`Pilih semua yang kamu temukan. Ada ${pengecoh} pengecoh.`}>Teknik apa yang dipakai pembuat klaim?</PageTitle>
      <Simulasi format={kasus.format}>{kasus.klaim}</Simulasi>
      <div className="chips" role="group" aria-label="Teknik manipulasi">
        {daftar.map((t) => {
          const on = pilih.includes(t.kode);
          let cls = "";
          let ket = "";
          if (sudah) {
            if (on && benar.has(t.kode)) [cls, ket] = ["ok", "tepat"];
            else if (on) [cls, ket] = ["wrong", "bukan di kasus ini"];
            else if (benar.has(t.kode)) [cls, ket] = ["miss", "terlewat"];
          }
          return (
            <button key={t.kode} type="button" className={`chip ${cls}`} aria-pressed={on} onClick={() => toggle(t.kode)} title={t.deskripsi}>
              {sudah && cls === "ok" && <Check aria-hidden />}
              {sudah && cls === "wrong" && <X aria-hidden />}
              {t.nama}
              {ket && <span style={{ fontSize: 13, fontWeight: 500 }}>· {ket}</span>}
            </button>
          );
        })}
      </div>
      {!sudah && (
        <details className="card soft tight">
          <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 28 }}>Apa arti setiap teknik?</summary>
          <dl className="stack-sm" style={{ margin: "12px 0 0" }}>
            {daftar.map((t) => (
              <div key={t.kode}>
                <dt style={{ fontWeight: 600, color: "var(--ink)" }}>{t.nama}</dt>
                <dd className="small muted" style={{ margin: 0 }}>
                  {t.deskripsi}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {coba && !pilih.length && !sudah && <Note tone="warn">Pilih sedikitnya satu teknik.</Note>}
      {sudah && (
        <>
          <Note tone="ok">{kasus.konten.pola}</Note>
          <Note>Alat deteksi otomatis hanya petunjuk tambahan. Ciri teknik di atas lebih bisa diandalkan daripada aplikasi pendeteksi.</Note>
        </>
      )}
      {!sudah ? (
        <button type="button" className="btn primary block" onClick={() => (pilih.length ? periksa() : setCoba(true))}>
          Periksa pilihanku
        </button>
      ) : (
        <button type="button" className="btn primary block" onClick={lanjut}>
          Lanjut ke tahap 4 <ArrowRight aria-hidden />
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------- hasil: jejak verifikasi (FR-2.8)
function Hasil({ kasus, sesi, ubah, keTahap, toast }: { kasus: Kasus; sesi: SesiLokal; ubah: TahapProps["ubah"]; keTahap: (t: number) => void; toast: (s: string) => void }) {
  const { konfig } = useApp();
  const nav = useNavigate();
  const [galat, setGalat] = useState<unknown>(null);
  const [simpan, setSimpan] = useState(false);
  const tanggal = (sesi.selesai ?? new Date().toISOString()).slice(0, 10) || hariIni();
  const isi = jejakDariLatihan(kasus, sesi.jawaban[2], tanggal);
  const { nilai, kurang } = kelengkapan(isi);

  async function simpanJejak() {
    setSimpan(true);
    const id = sesi.jejak_id ?? uuid();
    const now = new Date().toISOString();
    const lokal: Jejak = { id, sesi_id: sesi.id, mode: "latihan", ...isi, tindakan: sesi.keputusan?.tindakan ?? "", catatan: "", kelengkapan: nilai, kurang, dibuat_pada: now, diperbarui_pada: now };
    try {
      const r = await kirim<Jejak>("PUT", "/api/jejak", { id, sesi_id: sesi.id, tanggal_periksa: tanggal, diperbarui_pada: now });
      simpanJejakLokal(r ?? { ...lokal, antre: true });
      ubah((s) => ({ ...s, jejak_id: id }));
      toast(r ? "Jejak tersimpan." : "Jejak tersimpan di perangkat dan akan terkirim saat sinyal kembali.");
      nav(`/jejak/${id}`);
    } catch (e) {
      setGalat(e);
    } finally {
      setSimpan(false);
    }
  }

  return (
    <>
      <span className="badge ok">Latihan selesai</span>
      <PageTitle sub="Catatan ini bisa kamu tunjukkan ke fasilitator. Isinya hanya yang kamu periksa.">Jejak verifikasimu</PageTitle>
      <div className="card stack">
        <dl className="kv">
          <dt>Klaim</dt>
          <dd>{isi.klaim}</dd>
          <dt>Sumber primer</dt>
          <dd className={isi.sumber_primer ? "" : "kosong"}>{isi.sumber_primer || "Belum dipilih"}</dd>
          <dt>Pembanding</dt>
          <dd className={isi.pembanding ? "" : "kosong"}>{isi.pembanding || "Belum ada pembanding independen"}</dd>
          <dt>Tanggal periksa</dt>
          <dd>{tgl(tanggal)}</dd>
          <dt>Konteks</dt>
          <dd>{isi.konteks}</dd>
          <dt>Keputusan</dt>
          <dd>{labelOpsi(konfig?.jeda.tindakan, sesi.keputusan?.tindakan ?? "")}</dd>
        </dl>
        <UnsurChips kurang={kurang} />
      </div>
      {kurang.includes("pembanding") && (
        <Note tone="warn" icon={<TriangleAlert aria-hidden />}>
          <b>Jejak belum lengkap: pembanding independen belum dipilih.</b> Kembali ke tahap 2 untuk melengkapinya.
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary sm" onClick={() => keTahap(2)}>
              Kembali ke tahap 2
            </button>
          </div>
        </Note>
      )}
      {kurang.includes("sumber_primer") && !kurang.includes("pembanding") && (
        <Note tone="warn">
          <b>Jejak belum lengkap: sumber primer belum tepat.</b> Kembali ke tahap 2 untuk melengkapinya.
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary sm" onClick={() => keTahap(2)}>
              Kembali ke tahap 2
            </button>
          </div>
        </Note>
      )}
      <ErrorNote error={galat} />
      <button type="button" className="btn primary block" onClick={simpanJejak} disabled={simpan}>
        {simpan ? "Menyimpan…" : "Simpan jejak"}
      </button>
      <Link to="/jejak" className="btn secondary block">
        Lihat semua jejak
      </Link>
      <p className="caption" style={{ textAlign: "center" }}>
        Teknik di kasus ini: {kasus.teknik.map((t) => namaTeknik(konfig, t)).join(", ")}.
      </p>
    </>
  );
}
