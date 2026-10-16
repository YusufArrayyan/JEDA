import { useState } from "react";
import { Link } from "react-router-dom";
import { Back, ErrorNote, Field, Note, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";

const SKALA = ["Sangat tidak setuju", "Tidak setuju", "Netral", "Setuju", "Sangat setuju"];

export default function Survei() {
  const { konfig, muatUlang, profil } = useApp();
  const [jaw, setJaw] = useState<(number | null)[]>(Array(10).fill(null));
  const [saran, setSaran] = useState("");
  const [galat, setGalat] = useState<unknown>(null);
  const [coba, setCoba] = useState(false);
  const [selesai, setSelesai] = useState(false);

  if (selesai || profil?.sus_selesai) {
    return (
      <div className="stack-lg">
        <Back to="/" label="Beranda" />
        <PageTitle sub="Masukanmu dipakai untuk memperbaiki JEDA sebelum dipakai ruang lain.">Terima kasih!</PageTitle>
        <Link to="/" className="btn primary block">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const belum = jaw.filter((x) => x === null).length;

  async function kirim() {
    setCoba(true);
    if (belum) return;
    try {
      await api("/api/sus", { method: "POST", body: { jawaban: jaw, saran } });
      setSelesai(true);
      void muatUlang();
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <div className="stack-lg">
      <Back to="/" label="Beranda" />
      <PageTitle sub="Sepuluh pernyataan tentang pengalamanmu memakai JEDA. Tidak ada jawaban benar atau salah.">Survei singkat</PageTitle>
      {konfig?.sus.map((p, i) => (
        <fieldset key={i} className="card tight">
          <legend style={{ fontSize: 16, fontWeight: 600 }}>
            {i + 1}. {p}
          </legend>
          <div className="scale">
            {SKALA.map((s, k) => (
              <label key={k}>
                <input type="radio" name={`sus-${i}`} checked={jaw[i] === k + 1} onChange={() => setJaw((a) => a.map((v, x) => (x === i ? k + 1 : v)))} />
                <b>{k + 1}</b>
                {s}
              </label>
            ))}
          </div>
          {coba && jaw[i] === null && (
            <p className="field" style={{ marginTop: 6 }}>
              <span className="err">Pilih satu angka.</span>
            </p>
          )}
        </fieldset>
      ))}
      <Field label="Saran singkat (opsional)" htmlFor="saran" help="Saran tidak ikut ekspor data penelitian.">
        <textarea id="saran" className="textarea" maxLength={500} value={saran} onChange={(e) => setSaran(e.target.value)} />
      </Field>
      {coba && belum > 0 && <Note tone="warn">Masih ada {belum} pernyataan yang belum dinilai.</Note>}
      <ErrorNote error={galat} />
      <button type="button" className="btn primary block" onClick={kirim}>
        Kirim survei
      </button>
    </div>
  );
}
