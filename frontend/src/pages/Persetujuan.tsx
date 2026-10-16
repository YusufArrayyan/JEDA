import { Eye, Lock, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorNote, Logo, Note } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import type { Profil } from "../lib/types";

const POIN = [
  { ic: Target, judul: "Tujuan", isi: "Mengukur apakah latihan JEDA membantu kamu membedakan konten dan menahan diri sebelum berbagi. Hasilnya dipakai untuk evaluasi program pilot." },
  { ic: Lock, judul: "Data yang dikumpulkan", isi: "Nama samaran, ruang, jawaban latihan dan tes, keputusan berbagi, jejak yang kamu buat, dan usulan kartu. Surel hanya jika kamu memberikannya. Kami tidak mengumpulkan wajah, suara, kontak, lokasi, atau isi pesan pribadimu." },
  { ic: Eye, judul: "Siapa yang melihat", isi: "Data perseoranganmu hanya terlihat olehmu. Fasilitator dan admin hanya melihat angka gabungan, dan kelompok di bawah lima orang tidak ditampilkan." },
  { ic: Trash2, judul: "Cara menghapus", isi: "Kamu bisa berhenti kapan saja tanpa akibat. Buka Akun, lalu pilih Hapus dataku. Permintaan diproses paling lama 7 hari." },
];

export default function Persetujuan() {
  const { profil, setProfil } = useApp();
  const nav = useNavigate();
  const [setuju, setSetuju] = useState(false);
  const [bawah18, setBawah18] = useState<boolean | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const [cobaKirim, setCobaKirim] = useState(false);

  async function lanjut() {
    setCobaKirim(true);
    if (!setuju || bawah18 === null) return;
    try {
      const r = await api<{ profil: Profil }>("/api/persetujuan", { method: "POST", body: { setuju: true, di_bawah_18: bawah18 } });
      setProfil(r.profil);
      nav(r.profil.ruang?.tes_awal_buka && !r.profil.tes.awal ? "/tes/awal" : "/", { replace: true });
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "28px 20px 48px" }} className="stack-lg">
      <Logo />
      <div className="stack-sm">
        <span className="eyebrow">{profil?.ruang?.nama ?? "Ruang JEDA"}</span>
        <h1 tabIndex={-1} ref={(el) => el?.focus()}>
          Sebelum mulai, baca ini dulu
        </h1>
        <p className="lead">Persetujuanmu dicatat bersama waktunya. Tanpa persetujuan, tes dan latihan belum bisa dimulai.</p>
      </div>

      <div className="stack-sm">
        {POIN.map((p) => (
          <div key={p.judul} className="card tight row" style={{ alignItems: "flex-start" }}>
            <span className="iconbtn" style={{ flex: "none", background: "var(--brand-tint)", borderColor: "transparent", color: "var(--brand)" }} aria-hidden>
              <p.ic size={20} />
            </span>
            <div>
              <h3>{p.judul}</h3>
              <p className="muted small" style={{ marginTop: 2 }}>
                {p.isi}
              </p>
            </div>
          </div>
        ))}
      </div>

      <fieldset>
        <legend>Berapa usiamu?</legend>
        <div className="stack-sm">
          <label className="choice compact">
            <input type="radio" name="usia" checked={bawah18 === false} onChange={() => setBawah18(false)} />
            <span className="t">18 tahun atau lebih</span>
          </label>
          <label className="choice compact">
            <input type="radio" name="usia" checked={bawah18 === true} onChange={() => setBawah18(true)} />
            <span>
              <span className="t">Di bawah 18 tahun</span>
              <span className="d">Fasilitatormu akan mencatat persetujuan orang tua atau wali. Kamu tetap bisa berlatih sambil menunggu.</span>
            </span>
          </label>
        </div>
        {cobaKirim && bawah18 === null && <p className="field"><span className="err">Pilih salah satu rentang usia.</span></p>}
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} aria-invalid={cobaKirim && !setuju} />
        <span>Aku sudah membaca ringkasan di atas dan setuju dataku dipakai untuk evaluasi program JEDA.</span>
      </label>
      {cobaKirim && !setuju && <Note tone="warn">Centang kotak persetujuan untuk lanjut. Kamu boleh berhenti kapan saja.</Note>}
      <ErrorNote error={galat} />
      <button type="button" className="btn primary block" onClick={lanjut}>
        Setuju dan lanjut
      </button>
    </div>
  );
}
