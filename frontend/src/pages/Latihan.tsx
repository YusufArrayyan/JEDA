import { CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorNote, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { namaTema, namaTeknik, useApp } from "../lib/app";
import type { KasusRingkas } from "../lib/types";

export default function Latihan() {
  const { profil, konfig } = useApp();
  const [kasus, setKasus] = useState<KasusRingkas[] | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const [tema, setTema] = useState("");

  useEffect(() => {
    api<KasusRingkas[]>("/api/kasus").then(setKasus).catch(setGalat);
  }, []);

  const tampil = useMemo(() => (kasus ?? []).filter((k) => !tema || k.tema === tema), [kasus, tema]);

  if (profil?.latihan_terkunci) {
    return (
      <div className="stack-lg">
        <PageTitle>Latihan</PageTitle>
        <Empty icon={<Lock aria-hidden />} judul="Latihan dibuka setelah tes akhir">
          Ruangmu menjadi ruang pembanding untuk penelitian ini. Kerjakan tes awal dan tes akhir saat fasilitator membukanya, lalu semua latihan terbuka untukmu.
        </Empty>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <PageTitle sub="Setiap kasus berasal dari pesan yang pernah beredar di Bengkulu dan sudah diperiksa pemeriksa fakta. Satu latihan sekitar 10 menit.">Latihan</PageTitle>
      <div className="chips" role="group" aria-label="Saring menurut tema">
        <button type="button" className="chip" aria-pressed={!tema} onClick={() => setTema("")}>
          Semua
        </button>
        {konfig?.tema.map((t) => (
          <button key={t.kode} type="button" className="chip" aria-pressed={tema === t.kode} onClick={() => setTema(tema === t.kode ? "" : t.kode)}>
            {t.nama}
          </button>
        ))}
      </div>
      <ErrorNote error={galat} />
      {kasus && tampil.length === 0 && <Empty icon={<CheckCircle2 aria-hidden />} judul="Belum ada kasus untuk tema ini">Pilih tema lain atau tampilkan semua kasus.</Empty>}
      <div className="list" aria-busy={!kasus}>
        {tampil.map((k) => (
          <Link key={k.id} to={`/latihan/${k.id}`} className="list-item">
            <div className="grow stack-sm" style={{ gap: 6 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="badge">{namaTema(konfig, k.tema)}</span>
                {k.sudah_dilatih && (
                  <span className="badge ok">
                    <CheckCircle2 aria-hidden /> Sudah dilatih
                  </span>
                )}
              </div>
              <div className="title">{k.judul}</div>
              <span className="caption">{k.teknik.map((t) => namaTeknik(konfig, t)).join(" · ")}</span>
            </div>
            <ChevronRight aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
