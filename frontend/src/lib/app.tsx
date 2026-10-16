import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, NetError } from "./api";
import { antrean, mulaiSinkronOtomatis, sinkron } from "./offline";
import type { Konfigurasi, Profil } from "./types";

interface Ctx {
  profil: Profil | null;
  konfig: Konfigurasi | null;
  siap: boolean;
  online: boolean;
  antre: number;
  muatUlang: () => Promise<Profil | null>;
  setProfil: (p: Profil | null) => void;
  toast: (pesan: string) => void;
  toastPesan: string | null;
}

const AppCtx = createContext<Ctx | null>(null);

function bacaSimpanan<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profil, setProfilState] = useState<Profil | null>(null);
  const [konfig, setKonfig] = useState<Konfigurasi | null>(() => bacaSimpanan<Konfigurasi>("jeda.konfig"));
  const [siap, setSiap] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [antre, setAntre] = useState(() => antrean.jumlah());
  const [toastPesan, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const setProfil = useCallback((p: Profil | null) => {
    setProfilState(p);
    if (p) localStorage.setItem("jeda.profil", JSON.stringify(p));
    else localStorage.removeItem("jeda.profil");
  }, []);

  const muatUlang = useCallback(async () => {
    try {
      const r = await api<{ profil: Profil | null }>("/api/saya");
      setProfil(r.profil);
      return r.profil;
    } catch (e) {
      if (e instanceof NetError) {
        const p = bacaSimpanan<Profil>("jeda.profil");
        setProfilState(p);
        return p;
      }
      throw e;
    }
  }, [setProfil]);

  const toast = useCallback((pesan: string) => {
    setToast(pesan);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const k = await api<Konfigurasi>("/api/konfigurasi");
        setKonfig(k);
        localStorage.setItem("jeda.konfig", JSON.stringify(k));
      } catch {
        /* pakai simpanan */
      }
      await muatUlang().catch(() => null);
      setSiap(true);
    })();
  }, [muatUlang]);

  useEffect(() => {
    const naik = () => setOnline(true);
    const turun = () => setOnline(false);
    window.addEventListener("online", naik);
    window.addEventListener("offline", turun);
    const lepas = antrean.dengar((n) => setAntre(n));
    const stop = mulaiSinkronOtomatis();
    return () => {
      window.removeEventListener("online", naik);
      window.removeEventListener("offline", turun);
      lepas();
      stop();
    };
  }, []);

  // Saat sinyal kembali dan antrean habis, beri kabar singkat.
  const sebelumnya = useRef(antre);
  useEffect(() => {
    if (sebelumnya.current > 0 && antre === 0 && online) toast("Semua jawaban sudah terkirim.");
    sebelumnya.current = antre;
  }, [antre, online, toast]);

  useEffect(() => {
    if (online) void sinkron();
  }, [online]);

  const value = useMemo(() => ({ profil, konfig, siap, online, antre, muatUlang, setProfil, toast, toastPesan }), [profil, konfig, siap, online, antre, muatUlang, setProfil, toast, toastPesan]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp di luar AppProvider");
  return c;
}

export function namaTeknik(k: Konfigurasi | null, kode: string) {
  return k?.teknik.find((t) => t.kode === kode)?.nama ?? kode.replace(/_/g, " ");
}
export function namaTema(k: Konfigurasi | null, kode: string) {
  return k?.tema.find((t) => t.kode === kode)?.nama ?? kode.replace(/_/g, " ");
}
export function labelOpsi(list: { kode: string; label: string }[] | undefined, kode: string) {
  return list?.find((o) => o.kode === kode)?.label ?? kode;
}

const FMT_TGL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const FMT_JAM = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export function tgl(iso: string | null | undefined, jam = false) {
  if (!iso) return "–";
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return (jam ? FMT_JAM : FMT_TGL).format(d);
}

export const STATUS_LABEL: Record<string, string> = {
  draf: "Draf",
  diajukan: "Diajukan",
  ditelaah: "Ditelaah",
  terbit: "Terbit",
  ditolak: "Ditolak",
  diarsipkan: "Diarsipkan",
};
export const STATUS_NADA: Record<string, string> = {
  draf: "",
  diajukan: "brand",
  ditelaah: "warn",
  terbit: "ok",
  ditolak: "err",
  diarsipkan: "",
};
export const UNSUR_LABEL: Record<string, string> = {
  sumber_primer: "Sumber primer",
  pembanding: "Pembanding independen",
  tanggal_periksa: "Tanggal pemeriksaan",
  konteks: "Konteks klaim",
};
