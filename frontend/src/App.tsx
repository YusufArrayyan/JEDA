import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Logo } from "./components/ui";
import { useApp } from "./lib/app";
import type { Peran } from "./lib/types";
import Beranda from "./pages/Beranda";
import Masuk from "./pages/Masuk";
import Persetujuan from "./pages/Persetujuan";

import Akun from "./pages/Akun";
import Cek from "./pages/Cek";
import JejakDaftar from "./pages/Jejak";
import JejakDetail from "./pages/JejakDetail";
import Latihan from "./pages/Latihan";
import LatihanSesi from "./pages/LatihanSesi";
import Ruang from "./pages/Ruang";
import Survei from "./pages/Survei";
import Tes from "./pages/Tes";

// Layar peserta ikut paket utama agar tersimpan service worker untuk mode luring (FR-8.1).
// Layar staf dipisah agar paket awal tetap ringkas (NFR-2).
const Dasbor = lazy(() => import("./pages/staf/Dasbor"));
const KelolaRuang = lazy(() => import("./pages/staf/KelolaRuang"));
const Telaah = lazy(() => import("./pages/staf/Telaah"));
const KelolaKasus = lazy(() => import("./pages/staf/KelolaKasus"));
const EditorKasus = lazy(() => import("./pages/staf/EditorKasus"));
const Admin = lazy(() => import("./pages/staf/Admin"));
const Laporan = lazy(() => import("./pages/staf/Laporan"));

function Memuat() {
  return (
    <div style={{ minHeight: "60dvh", display: "grid", placeItems: "center" }} role="status" aria-label="Memuat">
      <Logo size={44} teks={false} />
    </div>
  );
}

function Wajib({ children, peran, lebar }: { children: ReactNode; peran?: Peran[]; lebar?: boolean }) {
  const { profil, siap } = useApp();
  const loc = useLocation();
  if (!siap) return <Memuat />;
  if (!profil) return <Navigate to="/masuk" replace state={{ dari: loc.pathname }} />;
  if (profil.peran === "peserta" && !profil.persetujuan && loc.pathname !== "/persetujuan") return <Navigate to="/persetujuan" replace />;
  if (peran && !peran.includes(profil.peran)) return <Navigate to="/" replace />;
  return (
    <Shell lebar={lebar}>
      <Suspense fallback={<Memuat />}>{children}</Suspense>
    </Shell>
  );
}

/** Layar awal per peran setelah masuk. */
export function layarAwal(peran: Peran) {
  return peran === "pemeriksa" ? "/telaah" : peran === "peserta" ? "/" : "/dasbor";
}

export default function App() {
  const { profil, siap } = useApp();
  return (
    <Routes>
      <Route path="/masuk" element={siap && profil ? <Navigate to={profil.persetujuan ? layarAwal(profil.peran) : "/persetujuan"} replace /> : <Masuk />} />
      <Route path="/persetujuan" element={!siap ? <Memuat /> : profil ? <Persetujuan /> : <Navigate to="/masuk" replace />} />
      <Route path="/" element={<Wajib><Beranda /></Wajib>} />
      <Route path="/latihan" element={<Wajib><Latihan /></Wajib>} />
      <Route path="/latihan/:kasusId" element={<Wajib><LatihanSesi /></Wajib>} />
      <Route path="/latihan/:kasusId/:sesiId" element={<Wajib><LatihanSesi /></Wajib>} />
      <Route path="/cek" element={<Wajib><Cek /></Wajib>} />
      <Route path="/jejak" element={<Wajib><JejakDaftar /></Wajib>} />
      <Route path="/jejak/:id" element={<Wajib><JejakDetail /></Wajib>} />
      <Route path="/ruang" element={<Wajib><Ruang /></Wajib>} />
      <Route path="/ruang/:tab" element={<Wajib><Ruang /></Wajib>} />
      <Route path="/tes/:tipe" element={<Wajib><Tes /></Wajib>} />
      <Route path="/survei" element={<Wajib><Survei /></Wajib>} />
      <Route path="/akun" element={<Wajib><Akun /></Wajib>} />
      <Route path="/dasbor" element={<Wajib peran={["fasilitator", "admin"]} lebar><Dasbor /></Wajib>} />
      <Route path="/laporan" element={<Wajib peran={["fasilitator", "admin"]} lebar><Laporan /></Wajib>} />
      <Route path="/kelola-ruang" element={<Wajib peran={["fasilitator", "admin"]} lebar><KelolaRuang /></Wajib>} />
      <Route path="/telaah" element={<Wajib peran={["fasilitator", "pemeriksa", "admin"]} lebar><Telaah /></Wajib>} />
      <Route path="/kelola-kasus" element={<Wajib peran={["pemeriksa", "admin"]} lebar><KelolaKasus /></Wajib>} />
      <Route path="/kelola-kasus/:id" element={<Wajib peran={["pemeriksa", "admin"]} lebar><EditorKasus /></Wajib>} />
      <Route path="/admin" element={<Wajib peran={["admin"]} lebar><Admin /></Wajib>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
