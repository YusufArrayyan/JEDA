import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Back, ErrorNote, Note, PageTitle } from "../../components/ui";
import { api } from "../../lib/api";
import { tgl } from "../../lib/app";
import { PanelRingkasan, type DasborData } from "./Dasbor";

export default function Laporan() {
  const [d, setD] = useState<DasborData | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  useEffect(() => {
    api<DasborData>("/api/dasbor").then(setD).catch(setGalat);
  }, []);

  return (
    <div className="stack-lg">
      <div className="row between no-print">
        <Back to="/dasbor" label="Dasbor" />
        <button type="button" className="btn primary sm" onClick={() => window.print()}>
          <Printer aria-hidden /> Cetak laporan
        </button>
      </div>
      <PageTitle sub={d ? `Data diambil ${tgl(d.diambil_pada, true)} · ${d.lingkup.length} ruang` : undefined}>Laporan pilot JEDA</PageTitle>
      {d?.mode_uji && <Note tone="warn">Laporan ini dibuat dari data contoh di lingkungan uji. Angkanya hanya ilustrasi.</Note>}
      <ErrorNote error={galat} />
      {d && (
        <>
          <section className="stack-sm">
            <h2>Ruang yang tercakup</h2>
            <p className="small">{d.lingkup.map((r) => `${r.nama}${r.pembanding ? " (pembanding)" : ""}`).join(", ")}.</p>
          </section>
          {d.perlakuan && (
            <section className="stack">
              <h2>Ruang perlakuan: K1–K3 dan P1–P5</h2>
              <PanelRingkasan r={d.perlakuan} k={d.k_min} />
            </section>
          )}
          {d.pembanding && (
            <section className="stack">
              <h2>Ruang pembanding</h2>
              <PanelRingkasan r={d.pembanding} k={d.k_min} hanyaTes />
            </section>
          )}
          <section className="stack-sm">
            <h2>Catatan metode</h2>
            <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
              <li>K1: perubahan rata-rata skor akurasi dari tes awal ke tes akhir pada peserta yang mengerjakan keduanya, dengan perangkat soal A/B yang diacak.</li>
              <li>K2: perubahan rata-rata niat membagikan (skala 1–5) pada butir keliru, menyesatkan, dan sintetis. Dilaporkan terpisah dari K1.</li>
              <li>K3: peserta aktif yang punya sedikitnya satu jejak dengan empat unsur lengkap.</li>
              <li>Hanya peserta dengan persetujuan tercatat (dan persetujuan wali bagi yang di bawah 18 tahun) yang masuk analisis. Kelompok di bawah {d.k_min} orang ditutup.</li>
              <li>Pilot tidak mengklaim dampak jangka panjang. Ukuran efek dan selang kepercayaan dihitung dari ekspor anonim.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
