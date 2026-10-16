import { ChevronRight, ClipboardCheck, CloudOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dots, Empty, ErrorNote, PageTitle } from "../components/ui";
import { api, NetError } from "../lib/api";
import { tgl } from "../lib/app";
import type { Jejak } from "../lib/types";

export function jejakLokalSemua(): Jejak[] {
  const out: Jejak[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("jeda.jejak.")) continue;
    try {
      out.push(JSON.parse(localStorage.getItem(k)!));
    } catch {
      /* abaikan */
    }
  }
  return out;
}

export default function JejakDaftar() {
  const [jejak, setJejak] = useState<Jejak[] | null>(null);
  const [galat, setGalat] = useState<unknown>(null);

  useEffect(() => {
    api<Jejak[]>("/api/jejak")
      .then((server) => {
        // Jejak yang masih di antrean perangkat ikut ditampilkan.
        const ids = new Set(server.map((j) => j.id));
        const antre = jejakLokalSemua().filter((j) => j.antre && !ids.has(j.id));
        setJejak([...antre, ...server]);
      })
      .catch((e) => {
        if (e instanceof NetError) setJejak(jejakLokalSemua().sort((a, b) => b.dibuat_pada.localeCompare(a.dibuat_pada)));
        else setGalat(e);
      });
  }, []);

  const lengkap = jejak?.filter((j) => j.kelengkapan === 4).length ?? 0;

  return (
    <div className="stack-lg">
      <PageTitle sub="Catatan setiap pemeriksaanmu. Hanya kamu yang bisa membuka isinya.">Jejak verifikasi</PageTitle>
      <ErrorNote error={galat} />
      {jejak && jejak.length > 0 && (
        <div className="grid-2">
          <div className="card tight">
            <p className="caption">Semua jejak</p>
            <p className="kpi">
              <span className="angka kecil">{jejak.length}</span>
            </p>
          </div>
          <div className="card tight">
            <p className="caption">Jejak lengkap (4 dari 4)</p>
            <p className="kpi">
              <span className="angka kecil">{lengkap}</span>
            </p>
          </div>
        </div>
      )}
      {jejak && jejak.length === 0 && (
        <Empty
          icon={<ClipboardCheck aria-hidden />}
          judul="Belum ada jejak"
          aksi={
            <Link to="/latihan" className="btn primary">
              Mulai latihan
            </Link>
          }
        >
          Jejak terbentuk otomatis setiap kali kamu menyelesaikan latihan atau Cek JEDA.
        </Empty>
      )}
      {jejak && jejak.length > 0 && (
        <div className="list">
          {jejak.map((j) => (
            <Link key={j.id} to={`/jejak/${j.id}`} className="list-item">
              <div className="grow stack-sm" style={{ gap: 4 }}>
                <div className="title">{j.klaim || "Klaim tidak disimpan"}</div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className={`badge ${j.mode === "cek" ? "brand" : ""}`}>{j.mode === "cek" ? "Cek JEDA" : "Latihan"}</span>
                  <span className="caption">{tgl(j.tanggal_periksa ?? j.dibuat_pada)}</span>
                  {j.antre && (
                    <span className="badge warn">
                      <CloudOff aria-hidden /> Belum terkirim
                    </span>
                  )}
                </div>
              </div>
              <Dots n={j.kelengkapan} />
              <ChevronRight aria-hidden />
            </Link>
          ))}
        </div>
      )}
      {!jejak && !galat && <p className="muted" role="status">Memuat jejak…</p>}
    </div>
  );
}
