import { Bell, Download, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Confirm, ErrorNote, Note, PageTitle } from "../components/ui";
import { api, simpanBlob } from "../lib/api";
import { tgl, useApp } from "../lib/app";
import { hapusDataPerangkat } from "../lib/offline";

const PERAN = { peserta: "Peserta", fasilitator: "Fasilitator", pemeriksa: "Pemeriksa fakta", admin: "Admin program" } as const;

export default function Akun() {
  const { profil, setProfil, toast, muatUlang } = useApp();
  const nav = useNavigate();
  const [notif, setNotif] = useState<{ id: string; teks: string; tautan: string; dibaca: boolean; waktu: string }[]>([]);
  const [galat, setGalat] = useState<unknown>(null);
  const [hapus, setHapus] = useState(false);

  useEffect(() => {
    api<typeof notif>("/api/notifikasi")
      .then((n) => {
        setNotif(n);
        if (n.some((x) => !x.dibaca)) void api("/api/notifikasi/baca", { method: "POST" }).then(() => muatUlang());
      })
      .catch(() => undefined);
  }, [muatUlang]);

  if (!profil) return null;

  async function keluar() {
    await api("/api/keluar", { method: "POST" }).catch(() => undefined);
    hapusDataPerangkat();
    setProfil(null);
    nav("/masuk", { replace: true });
  }

  async function unduhData() {
    try {
      const d = await api("/api/saya/data");
      simpanBlob(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), "data-jeda-saya.json");
      toast("Datamu sudah diunduh.");
    } catch (e) {
      setGalat(e);
    }
  }

  async function hapusData() {
    setHapus(false);
    try {
      await api("/api/saya", { method: "DELETE" });
      hapusDataPerangkat();
      setProfil(null);
      nav("/masuk", { replace: true });
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <div className="stack-lg">
      <PageTitle sub={`${PERAN[profil.peran]}${profil.ruang ? ` · ${profil.ruang.nama}` : ""}`}>{profil.nama_samaran}</PageTitle>

      {profil.peran === "peserta" && (
        <section className="stack-sm" aria-labelledby="h-tes">
          <h2 id="h-tes">Tes</h2>
          <div className="list">
            {(["awal", "akhir"] as const).map((t) => {
              const h = profil.tes[t];
              const buka = t === "awal" ? profil.ruang?.tes_awal_buka : profil.ruang?.tes_akhir_buka;
              return (
                <div key={t} className="list-item">
                  <div className="grow">
                    <div className="title">Tes {t}</div>
                    <span className="caption">{h ? `Selesai ${tgl(h.selesai_pada)} · akurasi ${Math.round(h.skor_akurasi)}%` : buka ? "Sudah dibuka fasilitator" : "Belum dibuka"}</span>
                  </div>
                  {h ? (
                    <Link to={`/tes/${t}`} className="btn ghost sm">
                      Lihat
                    </Link>
                  ) : buka && (t === "awal" || profil.tes.awal) ? (
                    <Link to={`/tes/${t}`} className="btn primary sm">
                      Mulai
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
          {profil.di_bawah_18 && (
            <p className="caption">Persetujuan orang tua atau wali: {profil.wali_disetujui ? "sudah dicatat fasilitator" : "belum dicatat fasilitator"}.</p>
          )}
        </section>
      )}

      <section className="stack-sm" aria-labelledby="h-kabar">
        <h2 id="h-kabar" className="row">
          <Bell size={20} aria-hidden /> Kabar
        </h2>
        {notif.length === 0 ? (
          <p className="muted small">Belum ada kabar. Hasil telaah usulan kartumu akan muncul di sini.</p>
        ) : (
          <div className="list">
            {notif.map((n) => (
              <Link key={n.id} to={n.tautan || "/"} className="list-item">
                <div className="grow">
                  <p className="small" style={{ color: "var(--ink)", fontWeight: n.dibaca ? 400 : 600 }}>
                    {n.teks}
                  </p>
                  <span className="caption">{tgl(n.waktu, true)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="h-data">
        <h2 id="h-data">Datamu</h2>
        <Note>Data perseoranganmu hanya terlihat olehmu. Fasilitator dan admin melihat angka gabungan dari sedikitnya lima orang.</Note>
        <button type="button" className="btn secondary block" onClick={unduhData}>
          <Download aria-hidden /> Unduh dataku (JSON)
        </button>
        <button type="button" className="btn secondary block" onClick={keluar}>
          <LogOut aria-hidden /> Keluar
        </button>
        {profil.peran === "peserta" && (
          <button type="button" className="btn ghost block" style={{ color: "var(--err)" }} onClick={() => setHapus(true)}>
            <Trash2 aria-hidden /> Hapus dataku
          </button>
        )}
        <ErrorNote error={galat} />
      </section>

      <Confirm open={hapus} judul="Hapus semua datamu?" ya="Hapus dataku" bahaya onYa={hapusData} onTidak={() => setHapus(false)}>
        Akun, jejak, latihan, dan kode pribadimu dihapus dan tidak bisa dikembalikan. Skor tes tetap tersimpan tanpa identitas untuk angka gabungan program.
      </Confirm>
    </div>
  );
}
