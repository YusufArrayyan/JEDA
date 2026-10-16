import { BookOpen, CheckCircle2, ClipboardCheck, FileStack, Gauge, Home, LayoutGrid, Search, ShieldCheck, Users, WifiOff, RefreshCw, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useApp } from "../lib/app";
import { Logo } from "./ui";

const TAB = [
  { to: "/", label: "Beranda", icon: Home, end: true },
  { to: "/latihan", label: "Latihan", icon: BookOpen },
  { to: "/cek", label: "Cek", icon: Search },
  { to: "/jejak", label: "Jejak", icon: ClipboardCheck },
  { to: "/ruang", label: "Ruang", icon: Users },
];

export function Shell({ children, lebar }: { children: ReactNode; lebar?: boolean }) {
  const { profil, konfig, online, antre, toastPesan } = useApp();
  const { pathname } = useLocation();
  const peran = profil?.peran;
  const staf = peran && peran !== "peserta";

  return (
    <div className="app">
      <a href="#isi" className="skip">
        Lewati ke isi
      </a>
      <nav className="sidenav" aria-label="Navigasi utama">
        <Link to="/" className="brand" aria-label="JEDA, ke Beranda">
          <Logo />
        </Link>
        {TAB.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            <t.icon aria-hidden /> {t.label}
          </NavLink>
        ))}
        {staf && <div className="grup">Tim program</div>}
        {(peran === "fasilitator" || peran === "admin") && (
          <>
            <NavLink to="/dasbor">
              <Gauge aria-hidden /> Dasbor
            </NavLink>
            <NavLink to="/kelola-ruang">
              <LayoutGrid aria-hidden /> Kelola ruang
            </NavLink>
          </>
        )}
        {staf && (
          <NavLink to="/telaah">
            <CheckCircle2 aria-hidden /> Telaah usulan
          </NavLink>
        )}
        {(peran === "pemeriksa" || peran === "admin") && (
          <NavLink to="/kelola-kasus">
            <FileStack aria-hidden /> Kelola kasus
          </NavLink>
        )}
        {peran === "admin" && (
          <NavLink to="/admin">
            <ShieldCheck aria-hidden /> Admin
          </NavLink>
        )}
        <div className="spacer" />
        <NavLink to="/akun">
          <UserRound aria-hidden /> {profil?.nama_samaran ?? "Akun"}
        </NavLink>
      </nav>

      <div className="wrap-main">
        {konfig?.mode_uji && (
          <div className="strip" role="note">
            <span>Lingkungan uji</span>
            <span>Data contoh</span>
          </div>
        )}
        {!online && (
          <div className="netbar" role="status">
            <WifiOff size={18} aria-hidden /> Koneksi terputus. Jawabanmu aman di perangkat dan akan terkirim saat sinyal kembali.
          </div>
        )}
        {online && antre > 0 && (
          <div className="netbar sinkron" role="status">
            <RefreshCw size={18} aria-hidden /> Mengirim {antre} jawaban yang tersimpan di perangkat…
          </div>
        )}
        <main id="isi" className={`main ${lebar ? "lebar" : ""} fade-in`} key={pathname}>
          {children}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Navigasi utama">
        {TAB.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            <t.icon aria-hidden />
            {t.label}
          </NavLink>
        ))}
      </nav>

      {toastPesan && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCircle2 aria-hidden /> {toastPesan}
        </div>
      )}
    </div>
  );
}
