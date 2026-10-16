import { ArrowRight, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorNote, Field, Logo, Note } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useApp } from "../lib/app";
import type { Profil } from "../lib/types";

type Mode = "ruang" | "kode" | "staf";

export default function Masuk() {
  const { setProfil, konfig } = useApp();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("ruang");
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [surel, setSurel] = useState("");
  const [kodePribadi, setKodePribadi] = useState("");
  const [sandi, setSandi] = useState("");
  const [galat, setGalat] = useState<unknown>(null);
  const [galatBidang, setGalatBidang] = useState<Record<string, string>>({});
  const [kirim, setKirim] = useState(false);
  const [baru, setBaru] = useState<{ kode: string; profil: Profil } | null>(null);
  const [tersalin, setTersalin] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    const g: Record<string, string> = {};
    if (mode === "ruang") {
      if (!kode.trim()) g.kode = "Isi kode ruang dari fasilitatormu.";
      if (nama.trim().length < 2) g.nama = "Isi nama samaran, minimal 2 huruf.";
    } else if (mode === "kode") {
      if (kodePribadi.replace(/[^A-Za-z0-9]/g, "").length < 8) g.kodePribadi = "Kode pribadi terdiri dari 8 huruf dan angka.";
    } else {
      if (!surel.includes("@")) g.surel = "Isi surel akun timmu.";
      if (!sandi) g.sandi = "Isi kata sandi.";
    }
    setGalatBidang(g);
    if (Object.keys(g).length) return;
    setKirim(true);
    try {
      if (mode === "ruang") {
        const r = await api<{ kode_pribadi: string; profil: Profil }>("/api/masuk/ruang", { method: "POST", body: { kode, nama_samaran: nama, surel: surel || null } });
        setBaru({ kode: r.kode_pribadi, profil: r.profil });
      } else if (mode === "kode") {
        const r = await api<{ profil: Profil }>("/api/masuk/kode", { method: "POST", body: { kode_pribadi: kodePribadi } });
        setProfil(r.profil);
      } else {
        const r = await api<{ profil: Profil }>("/api/masuk/staf", { method: "POST", body: { surel, kata_sandi: sandi } });
        // Rute /masuk mengalihkan ke layar awal peran begitu profil terisi.
        setProfil(r.profil);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "kode_tidak_ditemukan") setGalatBidang({ kode: `${err.message} ${err.hint}` });
      else setGalat(err);
    } finally {
      setKirim(false);
    }
  }

  if (baru) {
    return (
      <div className="auth">
        <Seni />
        <div className="auth-form fade-in">
          <Logo />
          <div className="stack-sm">
            <span className="badge ok">Kamu sudah masuk ke ruang</span>
            <h1 tabIndex={-1} ref={(el) => el?.focus()}>
              Simpan kode pribadimu
            </h1>
            <p className="lead">Pakai kode ini untuk masuk lagi dari ponsel lain atau setelah keluar. Kode hanya ditampilkan sekali.</p>
          </div>
          <div className="kode-besar" aria-label={`Kode pribadi ${baru.kode.split("").join(" ")}`}>
            {baru.kode}
          </div>
          <button
            type="button"
            className="btn secondary block"
            onClick={async () => {
              await navigator.clipboard?.writeText(baru.kode).catch(() => undefined);
              setTersalin(true);
            }}
          >
            <Copy aria-hidden /> {tersalin ? "Kode tersalin" : "Salin kode"}
          </button>
          <Note>Tulis di buku catatan atau simpan sebagai foto. Fasilitator tidak bisa melihat kode ini.</Note>
          <button
            type="button"
            className="btn primary block"
            onClick={() => {
              setProfil(baru.profil);
              nav("/persetujuan", { replace: true });
            }}
          >
            Aku sudah menyimpannya <ArrowRight aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <Seni />
      <div className="auth-form">
        {konfig?.mode_uji && (
          <span className="badge warn" style={{ alignSelf: "flex-start" }}>
            Lingkungan uji · data contoh
          </span>
        )}
        <Logo size={40} />
        <div className="stack-sm">
          <h1>{mode === "staf" ? "Masuk sebagai tim program" : mode === "kode" ? "Masuk dengan kode pribadi" : "Berhenti sebentar, periksa dulu."}</h1>
          <p className="lead">{mode === "staf" ? "Untuk fasilitator, pemeriksa fakta, dan admin program." : "Latihan 10 menit untuk memeriksa informasi sebelum kamu membagikannya."}</p>
        </div>

        <form className="stack" onSubmit={submit} noValidate>
          {mode === "ruang" && (
            <>
              <Field label="Kode ruang" htmlFor="kode" help="Kode dari fasilitatormu, misalnya JD-07-BKL." error={galatBidang.kode}>
                <input id="kode" className="input code" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={kode} onChange={(e) => setKode(e.target.value)} aria-invalid={!!galatBidang.kode} aria-describedby={galatBidang.kode ? "kode-err" : "kode-help"} />
              </Field>
              <Field label="Nama samaran" htmlFor="nama" help="Nama yang dilihat fasilitator. Tidak perlu nama asli lengkap." error={galatBidang.nama}>
                <input id="nama" className="input" autoComplete="nickname" maxLength={24} value={nama} onChange={(e) => setNama(e.target.value)} aria-invalid={!!galatBidang.nama} aria-describedby={galatBidang.nama ? "nama-err" : "nama-help"} />
              </Field>
              <Field label="Surel (opsional)" htmlFor="surel" help="Hanya untuk kabar hasil telaah kartu. Boleh dikosongkan.">
                <input id="surel" className="input" type="email" inputMode="email" autoComplete="email" value={surel} onChange={(e) => setSurel(e.target.value)} aria-describedby="surel-help" />
              </Field>
            </>
          )}
          {mode === "kode" && (
            <Field label="Kode pribadi" htmlFor="kp" help="Delapan huruf dan angka yang muncul saat pertama kali bergabung." error={galatBidang.kodePribadi}>
              <input id="kp" className="input code" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} value={kodePribadi} onChange={(e) => setKodePribadi(e.target.value)} aria-invalid={!!galatBidang.kodePribadi} aria-describedby={galatBidang.kodePribadi ? "kp-err" : "kp-help"} />
            </Field>
          )}
          {mode === "staf" && (
            <>
              <Field label="Surel" htmlFor="ss" error={galatBidang.surel}>
                <input id="ss" className="input" type="email" inputMode="email" autoComplete="username" value={surel} onChange={(e) => setSurel(e.target.value)} aria-invalid={!!galatBidang.surel} />
              </Field>
              <Field label="Kata sandi" htmlFor="pw" error={galatBidang.sandi}>
                <input id="pw" className="input" type="password" autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)} aria-invalid={!!galatBidang.sandi} />
              </Field>
            </>
          )}
          <ErrorNote error={galat} />
          <button className="btn primary block" disabled={kirim}>
            {kirim ? "Memeriksa…" : mode === "ruang" ? "Masuk dengan kode ruang" : "Masuk"}
          </button>
        </form>

        <div className="stack-sm">
          {mode !== "ruang" && (
            <button type="button" className="btn ghost" onClick={() => { setMode("ruang"); setGalat(null); setGalatBidang({}); }}>
              Bergabung dengan kode ruang
            </button>
          )}
          {mode !== "kode" && (
            <button type="button" className="btn ghost" onClick={() => { setMode("kode"); setGalat(null); setGalatBidang({}); }}>
              <KeyRound aria-hidden /> Sudah pernah bergabung? Pakai kode pribadi
            </button>
          )}
          {mode !== "staf" && (
            <button type="button" className="btn ghost" onClick={() => { setMode("staf"); setGalat(null); setGalatBidang({}); }}>
              <ShieldCheck aria-hidden /> Masuk sebagai tim program
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Seni() {
  return (
    <aside className="auth-art" aria-hidden>
      <Logo size={40} />
      <div className="stack-lg">
        <p className="big-quote">Jeda dahulu, vonis tidak pernah.</p>
        <p style={{ color: "#d5ddef", maxWidth: "44ch", fontSize: 17 }}>JEDA tidak memutuskan benar atau salah. Kamu yang menelusuri sumbernya, menimbang buktinya, lalu memilih sikap.</p>
        <div className="steps-mini">
          <div><b>J</b>Jelajah Sumber</div>
          <div><b>E</b>Evaluasi Bukti</div>
          <div><b>D</b>Deteksi Manipulasi</div>
          <div><b>A</b>Ambil Sikap</div>
        </div>
      </div>
      <p style={{ color: "#9fb0d6", fontSize: 13 }}>Program pilot literasi verifikasi · Bengkulu</p>
    </aside>
  );
}
