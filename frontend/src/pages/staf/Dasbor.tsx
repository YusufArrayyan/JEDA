import { Download, EyeOff, FileText, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorNote, Note, PageTitle } from "../../components/ui";
import { api, unduh } from "../../lib/api";
import { tgl } from "../../lib/app";
import type { Metrik, Ringkasan } from "../../lib/types";

export interface DasborData {
  mode_uji: boolean;
  diambil_pada: string;
  k_min: number;
  lingkup: { id: string; nama: string; pembanding: boolean }[];
  perlakuan: Ringkasan | null;
  pembanding: Ringkasan | null;
  per_ruang: (Ringkasan & { ruang: { id: string; nama: string; pembanding: boolean } })[];
}

export const fmtAngka = (v: number | null | undefined) => (v == null ? "–" : v.toLocaleString("id-ID", { maximumFractionDigits: 2 }));

export const fmtPersen = (v: number | null | undefined, tanda = false) => (v == null ? "–" : `${tanda && v > 0 ? "+" : ""}${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`);

export function Tertutup({ k }: { k: number }) {
  return (
    <span className="row caption" style={{ gap: 6 }}>
      <EyeOff size={16} aria-hidden /> Data belum cukup (kurang dari {k} orang)
    </span>
  );
}

function KpiUtama({ judul, m, nilai, target, persen, tercapai, keterangan, k, netral }: { judul: string; m: Metrik; nilai: string; target: string; persen: number; tercapai: boolean; keterangan?: string; k: number; netral?: boolean }) {
  return (
    <article className="card kpi">
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <h3 style={{ fontSize: 15 }}>{judul}</h3>
        {!m.tertutup && !netral && <span className={`status-dot`} style={{ color: tercapai ? "var(--ok)" : "var(--warn)" }}>{tercapai ? "Target tercapai" : "Belum tercapai"}</span>}
      </div>
      {m.tertutup ? (
        <Tertutup k={k} />
      ) : (
        <>
          <span className="angka">{nilai}</span>
          <div className="bar" role="img" aria-label={`${nilai}, target ${target}`}>
            <i className={tercapai && !netral ? "ok" : ""} style={{ width: `${Math.max(2, Math.min(100, persen))}%` }} />
          </div>
          <span className="caption">
            {netral ? "pembanding, tanpa target" : `target ${target}`}
            {keterangan ? ` · ${keterangan}` : ""}
          </span>
        </>
      )}
    </article>
  );
}

export function PanelRingkasan({ r, k, hanyaTes }: { r: Ringkasan; k: number; hanyaTes?: boolean }) {
  const k1 = r.k1.nilai as number | null;
  const k2 = r.k2.nilai as number | null;
  const k3 = r.k3.nilai as number | null;
  return (
    <div className="stack">
      <div className="grid-auto grid-kpi">
        <article className="card kpi">
          <h3 style={{ fontSize: 15 }}>Peserta aktif</h3>
          {r.peserta_aktif.tertutup ? <Tertutup k={k} /> : <span className="angka">{r.peserta_aktif.nilai}</span>}
          <span className="caption">{r.peserta_terdaftar.tertutup ? "terdaftar: data belum cukup" : `dari ${r.peserta_terdaftar.nilai} peserta yang masuk analisis`}</span>
        </article>
        <KpiUtama k={k} netral={hanyaTes} judul="K1 · Akurasi membedakan konten" m={r.k1} nilai={fmtPersen(k1, true)} target="+20%" persen={((k1 ?? 0) / 20) * 100} tercapai={(k1 ?? -1) >= 20} keterangan={r.k1.awal != null ? `rata-rata ${fmtAngka(r.k1.awal)} → ${fmtAngka(r.k1.akhir)}` : undefined} />
        <KpiUtama k={k} netral={hanyaTes} judul="K2 · Niat membagikan info belum terverifikasi" m={r.k2} nilai={fmtPersen(k2, true)} target="−15%" persen={(-(k2 ?? 0) / 15) * 100} tercapai={(k2 ?? 1) <= -15} keterangan={r.k2.awal != null ? `skala 1–5: ${fmtAngka(r.k2.awal)} → ${fmtAngka(r.k2.akhir)}` : undefined} />
        {!hanyaTes && <KpiUtama k={k} judul="K3 · Peserta dengan jejak lengkap" m={r.k3} nilai={fmtPersen(k3)} target="80%" persen={k3 ?? 0} tercapai={(k3 ?? 0) >= 80} keterangan={r.k3.lengkap != null ? `${r.k3.lengkap} peserta` : undefined} />}
      </div>
      {!hanyaTes && <div className="tbl-wrap">
        <table className="tbl">
          <caption className="sr-only">Metrik pendukung P1 sampai P5</caption>
          <thead>
            <tr>
              <th>Metrik pendukung</th>
              <th className="num">Nilai</th>
              <th className="num">Target</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["P1 · Penyelesaian latihan", r.p1, fmtPersen(r.p1.nilai as number), "≥ 70%"],
              ["P2 · Median durasi satu latihan", r.p2, r.p2.nilai != null ? `${fmtAngka(r.p2.nilai as number)} menit` : "–", "≤ 10 menit"],
              ["P3 · Skor SUS", r.p3, fmtAngka(r.p3.nilai as number), "≥ 68"],
              ["P4 · Kartu terbit per 5 peserta", r.p4, r.p4.nilai != null ? `${fmtAngka(r.p4.nilai as number)} (${r.p4.terbit} kartu)` : "–", "≥ 1"],
              ["P5 · Cek JEDA per peserta per minggu", r.p5, fmtAngka(r.p5.nilai as number), "dilaporkan"],
            ].map(([nama, m, v, t]) => (
              <tr key={nama as string}>
                <td>{nama as string}</td>
                <td className="num">{(m as Metrik).tertutup ? <span className="caption">data belum cukup</span> : (v as string)}</td>
                <td className="num caption">{t as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {!hanyaTes && r.luring.nilai && !r.luring.tertutup && (
        <p className="caption">
          Jalur luring: {r.luring.nilai.sesi} sesi, {r.luring.nilai.peserta} kehadiran peserta, {r.luring.nilai.latihan_selesai} latihan selesai, {r.luring.nilai.jejak_lengkap} jejak lengkap (rekap fasilitator, agregat).
        </p>
      )}
    </div>
  );
}

export default function Dasbor() {
  const [d, setD] = useState<DasborData | null>(null);
  const [ruang, setRuang] = useState("");
  const [galat, setGalat] = useState<unknown>(null);

  useEffect(() => {
    api<DasborData>(`/api/dasbor${ruang ? `?ruang_id=${ruang}` : ""}`).then(setD).catch(setGalat);
  }, [ruang]);

  return (
    <div className="stack-lg">
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <PageTitle sub="Semua angka bersifat gabungan. Kelompok di bawah lima orang tidak ditampilkan.">Dasbor fasilitator</PageTitle>
        <div className="row wrap no-print">
          <label className="sr-only" htmlFor="pilih-ruang">
            Pilih ruang
          </label>
          <select id="pilih-ruang" className="select" style={{ width: "auto", minWidth: 220 }} value={ruang} onChange={(e) => setRuang(e.target.value)}>
            <option value="">Semua ruangku</option>
            {d?.lingkup.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama}
                {r.pembanding ? " (pembanding)" : ""}
              </option>
            ))}
          </select>
          <button type="button" className="btn secondary sm" onClick={() => unduh(`/api/dasbor/csv${ruang ? `?ruang_id=${ruang}` : ""}`, "rekap-jeda.csv").catch(setGalat)}>
            <Download aria-hidden /> Unduh rekap CSV
          </button>
          <Link to="/laporan" className="btn ghost sm">
            <FileText aria-hidden /> Laporan pilot
          </Link>
        </div>
      </div>
      {d?.mode_uji && (
        <Note tone="warn" icon={<Info aria-hidden />}>
          Angka di layar ini hanya ilustrasi dari data contoh. Pada ruang nyata, data bersifat agregat dan kelompok di bawah 5 orang tidak ditampilkan.
        </Note>
      )}
      <ErrorNote error={galat} />
      {d && (
        <>
          {d.perlakuan && (
            <section className="stack" aria-labelledby="h-perlakuan">
              <h2 id="h-perlakuan">Ruang perlakuan</h2>
              <PanelRingkasan r={d.perlakuan} k={d.k_min} />
            </section>
          )}
          {d.pembanding && (
            <section className="stack" aria-labelledby="h-pembanding">
              <h2 id="h-pembanding">Ruang pembanding</h2>
              <p className="small muted">Ruang pembanding hanya mengerjakan tes. K1 dan K2 di sini menjadi pembanding untuk ruang perlakuan.</p>
              <PanelRingkasan r={d.pembanding} k={d.k_min} hanyaTes />
            </section>
          )}
          {d.per_ruang.length > 0 && (
            <section className="stack-sm" aria-labelledby="h-perruang">
              <h2 id="h-perruang">Per ruang</h2>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ruang</th>
                      <th className="num">Peserta aktif</th>
                      <th className="num">K1</th>
                      <th className="num">K2</th>
                      <th className="num">K3</th>
                      <th className="num">P1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.per_ruang.map((r) => (
                      <tr key={r.ruang.id}>
                        <td>
                          {r.ruang.nama}
                          {r.ruang.pembanding && <span className="badge" style={{ marginLeft: 8 }}>pembanding</span>}
                        </td>
                        <td className="num">{r.peserta_aktif.tertutup ? `<${d.k_min}` : (r.peserta_aktif.nilai as number)}</td>
                        <td className="num">{r.k1.tertutup ? "–" : fmtPersen(r.k1.nilai as number, true)}</td>
                        <td className="num">{r.k2.tertutup ? "–" : fmtPersen(r.k2.nilai as number, true)}</td>
                        <td className="num">{r.ruang.pembanding ? <span className="caption">tidak berlaku</span> : r.k3.tertutup ? "–" : fmtPersen(r.k3.nilai as number)}</td>
                        <td className="num">{r.ruang.pembanding ? <span className="caption">tidak berlaku</span> : r.p1.tertutup ? "–" : fmtPersen(r.p1.nilai as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="caption">“–” berarti data belum cukup (kurang dari {d.k_min} orang). Data diambil {tgl(d.diambil_pada, true)}.</p>
            </section>
          )}
        </>
      )}
      {!d && !galat && <p className="muted" role="status">Memuat dasbor…</p>}
    </div>
  );
}
