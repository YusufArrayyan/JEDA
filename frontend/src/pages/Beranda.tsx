import { ArrowRight, Bell, ClipboardList, Lock, MessageSquareWarning, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dots, Note } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { sesiLokalAktif, siapkanLuring } from "../lib/offline";
import type { Jejak, KasusRingkas } from "../lib/types";

export const TAHAP = [
  { h: "J", nama: "Jelajah Sumber", isi: "Cari tahu siapa yang bicara", tint: "tint-j" },
  { h: "E", nama: "Evaluasi Bukti", isi: "Bandingkan dua sumber", tint: "tint-e" },
  { h: "D", nama: "Deteksi Manipulasi", isi: "Kenali tipuannya", tint: "tint-d" },
  { h: "A", nama: "Ambil Sikap", isi: "Putuskan sebelum kirim", tint: "tint-a" },
];

const TARGET_MINGGUAN = 5;

export default function Beranda() {
  const { profil } = useApp();
  const [kasus, setKasus] = useState<KasusRingkas[] | null>(null);
  const [jejak, setJejak] = useState<Jejak[]>([]);
  const [aktif, setAktif] = useState<{ id: string; kasus_id: string | null; tahap: number } | null>(null);

  useEffect(() => {
    api<KasusRingkas[]>("/api/kasus")
      .then((k) => {
        setKasus(k);
        // Simpan semua kasus ke perangkat saat jaringan menganggur (FR-8.1).
        const jalan = () => void siapkanLuring(k.map((x) => x.id));
        "requestIdleCallback" in window ? window.requestIdleCallback(jalan) : setTimeout(jalan, 1500);
      })
      .catch(() => setKasus([]));
    api<Jejak[]>("/api/jejak").then(setJejak).catch(() => undefined);
    const lokal = sesiLokalAktif();
    api<{ id: string; kasus_id: string; tahap_terakhir: number } | null>("/api/sesi/aktif")
      .then((s) => {
        // Status di perangkat lebih baru daripada server bila ada jawaban yang belum terkirim.
        if (lokal) setAktif({ id: lokal.id, kasus_id: lokal.kasus_id, tahap: lokal.tahap });
        else if (s) setAktif({ id: s.id, kasus_id: s.kasus_id, tahap: Math.min(s.tahap_terakhir + 1, 4) });
      })
      .catch(() => lokal && setAktif({ id: lokal.id, kasus_id: lokal.kasus_id, tahap: lokal.tahap }));
  }, []);

  const hariIni = useMemo(() => {
    if (!kasus?.length) return null;
    if (aktif?.kasus_id) return kasus.find((k) => k.id === aktif.kasus_id) ?? null;
    return kasus.find((k) => !k.sudah_dilatih) ?? kasus[0];
  }, [kasus, aktif]);

  const mingguIni = useMemo(() => {
    const d = new Date();
    const senin = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return jejak.filter((j) => new Date(j.dibuat_pada) >= senin);
  }, [jejak]);
  const belumLengkap = jejak.filter((j) => j.kelengkapan < 4).length;

  if (!profil) return null;
  const terkunci = profil.latihan_terkunci;
  const perluTesAwal = profil.peran === "peserta" && profil.ruang?.tes_awal_buka && !profil.tes.awal;
  const perluTesAkhir = profil.peran === "peserta" && profil.ruang?.tes_akhir_buka && profil.tes.awal && !profil.tes.akhir;
  const inisial = profil.nama_samaran.slice(0, 1).toUpperCase();

  return (
    <div className="stack-lg">
      <div className="row between">
        <span className="caption">{profil.ruang?.nama ?? "JEDA"}</span>
        <Link to="/akun" className="iconbtn" aria-label={`Akun ${profil.nama_samaran}${profil.notifikasi_baru ? `, ${profil.notifikasi_baru} kabar baru` : ""}`} style={{ background: "var(--brand-tint)", borderColor: "transparent", color: "var(--brand-deep)", fontWeight: 700 }}>
          {inisial}
          {profil.notifikasi_baru > 0 && <span style={{ position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 99, background: "var(--err)", border: "2px solid #fff" }} />}
        </Link>
      </div>

      <section className="hero stack" aria-labelledby="sapa">
        <div className="stack-sm">
          <h1 id="sapa" tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })}>
            Halo, {profil.nama_samaran}
          </h1>
          <p>
            {terkunci
              ? "Ruangmu sedang menjadi ruang pembanding. Latihan dibuka setelah tes akhir."
              : `Hari ini kamu punya ${aktif ? "1 latihan yang belum selesai" : "1 latihan"}${belumLengkap ? ` dan ${belumLengkap} jejak yang belum lengkap` : ""}.`}
          </p>
        </div>
        {hariIni && !terkunci && (
          <div className="card" style={{ background: "rgba(255,255,255,0.97)", border: 0, color: "var(--charcoal)" }}>
            <div className="stack-sm">
              <span className="badge brand">Kasus lokal Bengkulu</span>
              <h2 style={{ color: "var(--ink)" }}>{hariIni.judul}</h2>
              <p className="small muted">10 menit · 4 tahap · kasus sudah diverifikasi</p>
              <Link className="btn primary block" to={aktif ? `/latihan/${aktif.kasus_id}/${aktif.id}` : `/latihan/${hariIni.id}`} style={{ marginTop: 6 }}>
                <Play aria-hidden /> {aktif ? `Lanjutkan tahap ${aktif.tahap > 4 ? 4 : aktif.tahap}` : "Mulai latihan"}
              </Link>
            </div>
          </div>
        )}
        {terkunci && (
          <div className="row" style={{ color: "#d5ddef" }}>
            <Lock size={18} aria-hidden /> Terima kasih sudah membantu penelitian ini.
          </div>
        )}
      </section>

      {(perluTesAwal || perluTesAkhir) && (
        <Link to={perluTesAwal ? "/tes/awal" : "/tes/akhir"} className="card row" style={{ borderColor: "#cbd9f6", background: "var(--brand-tint)" }}>
          <ClipboardList aria-hidden style={{ color: "var(--brand)", flex: "none" }} />
          <div style={{ flex: 1 }}>
            <h3>{perluTesAwal ? "Tes awal sudah dibuka" : "Tes akhir sudah dibuka"}</h3>
            <p className="small muted">8 butir, sekitar 6 menit. Hasilnya hanya kamu yang lihat.</p>
          </div>
          <ArrowRight aria-hidden style={{ color: "var(--brand)" }} />
        </Link>
      )}
      {profil.peran === "peserta" && profil.di_bawah_18 && !profil.wali_disetujui && (
        <Note tone="brand" icon={<Bell aria-hidden />}>
          Fasilitatormu belum mencatat persetujuan orang tua atau wali. Kamu tetap bisa berlatih; jawabanmu baru masuk analisis setelah persetujuan itu tercatat.
        </Note>
      )}

      <section className="stack-sm" aria-labelledby="empat">
        <h2 id="empat">Empat tahap JEDA</h2>
        <div className="tiles">
          {TAHAP.map((t) => (
            <div key={t.h} className={`tile ${t.tint}`}>
              <span className="huruf" aria-hidden>
                {t.h}
              </span>
              <b>{t.nama}</b>
              <span>{t.isi}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack-sm" aria-labelledby="pesanbaru">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <MessageSquareWarning aria-hidden style={{ color: "var(--brand)", flex: "none", marginTop: 2 }} />
          <div className="stack-sm" style={{ flex: 1 }}>
            <h2 id="pesanbaru">Ada pesan yang baru masuk?</h2>
            <p className="muted">Periksa dulu sebelum kamu teruskan.</p>
          </div>
        </div>
        <Link to="/cek" className="btn secondary block">
          Cek klaim
        </Link>
      </section>

      <section className="stack-sm" aria-labelledby="mingguan">
        <div className="section-title">
          <h2 id="mingguan">Jejak minggu ini</h2>
          <span className="caption">
            {Math.min(mingguIni.length, TARGET_MINGGUAN)} dari {TARGET_MINGGUAN}
          </span>
        </div>
        <div className="bar" aria-hidden>
          <i className="ok" style={{ width: `${Math.min(100, (mingguIni.length / TARGET_MINGGUAN) * 100)}%` }} />
        </div>
        {jejak.slice(0, 3).length > 0 ? (
          <div className="list">
            {jejak.slice(0, 3).map((j) => (
              <Link key={j.id} to={`/jejak/${j.id}`} className="list-item">
                <div className="grow">
                  <div className="title">{j.klaim || "Klaim tidak disimpan"}</div>
                  <span className="caption">{j.mode === "cek" ? "Cek JEDA" : "Latihan"}</span>
                </div>
                <Dots n={j.kelengkapan} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted small">Belum ada jejak minggu ini. Selesaikan satu latihan untuk membuat jejak pertamamu.</p>
        )}
      </section>
    </div>
  );
}
