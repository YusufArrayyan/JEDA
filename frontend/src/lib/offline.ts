/* Mode luring (M8): antrean tulis, simpanan kasus, dan status sesi latihan di perangkat.
 * Semua penulisan ke server bersifat idempoten (ID dibuat di sini, waktu ikut dikirim),
 * jadi aman dikirim ulang. Konflik diselesaikan server dengan waktu terbaru (FR-8.2).
 */
import { api, ApiError, NetError } from "./api";
import type { Jejak, Kasus, Keputusan, Sumber } from "./types";

const OUTBOX = "jeda.outbox";
const PREFIX_KASUS = "jeda.kasus.";
const PREFIX_SESI = "jeda.sesi.";

export interface Tugas {
  id: string;
  method: "PUT" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  dibuat: string;
}

type Pendengar = (n: number) => void;
const pendengar = new Set<Pendengar>();

function baca<T>(key: string, bawaan: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : bawaan;
  } catch {
    return bawaan;
  }
}
function tulis(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* penyimpanan penuh: abaikan, data tetap di memori sesi ini */
  }
}

export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const antrean = {
  daftar: () => baca<Tugas[]>(OUTBOX, []),
  jumlah: () => baca<Tugas[]>(OUTBOX, []).length,
  dengar(fn: Pendengar) {
    pendengar.add(fn);
    return () => pendengar.delete(fn);
  },
};

function beritahu() {
  const n = antrean.jumlah();
  pendengar.forEach((f) => f(n));
}

/** Kirim sekarang; bila luring, masuk antrean dan kembalikan null. */
export async function kirim<T>(method: Tugas["method"], path: string, body?: unknown): Promise<T | null> {
  // Jaga urutan: bila antrean belum kosong, tugas baru menunggu di belakangnya.
  if (antrean.jumlah() > 0) {
    simpanTugas({ method, path, body });
    void sinkron();
    return null;
  }
  try {
    return await api<T>(path, { method, body });
  } catch (e) {
    if (e instanceof NetError) {
      simpanTugas({ method, path, body });
      return null;
    }
    throw e;
  }
}

function simpanTugas(t: Omit<Tugas, "id" | "dibuat">) {
  const q = antrean.daftar();
  q.push({ ...t, id: uuid(), dibuat: new Date().toISOString() });
  tulis(OUTBOX, q);
  beritahu();
}

let sedang = false;
export async function sinkron(): Promise<{ terkirim: number; gagal: number }> {
  if (sedang) return { terkirim: 0, gagal: 0 };
  sedang = true;
  let terkirim = 0;
  let gagal = 0;
  try {
    for (;;) {
      const q = antrean.daftar();
      if (!q.length) break;
      const t = q[0];
      try {
        await api(t.path, { method: t.method, body: t.body });
        terkirim++;
      } catch (e) {
        if (e instanceof NetError) break;
        if (e instanceof ApiError && (e.status === 401 || e.status === 429 || e.status >= 500)) break;
        // Galat 4xx lain tidak akan berhasil bila diulang; buang agar antrean tidak macet.
        gagal++;
      }
      tulis(OUTBOX, antrean.daftar().filter((x) => x.id !== t.id));
      beritahu();
    }
  } finally {
    sedang = false;
  }
  return { terkirim, gagal };
}

export function mulaiSinkronOtomatis(): () => void {
  const on = () => void sinkron();
  window.addEventListener("online", on);
  const iv = window.setInterval(() => {
    if (navigator.onLine && antrean.jumlah()) void sinkron();
  }, 15000);
  void sinkron();
  return () => {
    window.removeEventListener("online", on);
    window.clearInterval(iv);
  };
}

// ------------------------------------------------------------------ simpanan kasus

export function simpanKasus(k: Kasus) {
  tulis(PREFIX_KASUS + k.id, k);
}
export function kasusLokal(id: string): Kasus | null {
  return baca<Kasus | null>(PREFIX_KASUS + id, null);
}
export async function ambilKasus(id: string): Promise<Kasus> {
  try {
    const k = await api<Kasus>(`/api/kasus/${id}`);
    simpanKasus(k);
    return k;
  } catch (e) {
    const lokal = kasusLokal(id);
    if (e instanceof NetError && lokal) return lokal;
    throw e;
  }
}
/** Unduh semua kasus terbit ke perangkat agar latihan bisa dijalankan dalam mode pesawat (FR-8.1). */
export async function siapkanLuring(ids: string[]) {
  for (const id of ids) {
    if (kasusLokal(id)) continue;
    try {
      simpanKasus(await api<Kasus>(`/api/kasus/${id}`));
    } catch {
      return;
    }
  }
}

// ------------------------------------------------------------------ sesi latihan di perangkat

export interface SesiLokal {
  id: string;
  kasus_id: string | null;
  mode: "latihan" | "cek";
  mulai: string;
  tahap: number; // tahap yang sedang dibuka (1..5; 5 = hasil)
  jawaban: { 1?: { pilihan: string[] }; 2?: { primer: string | null; pembanding: string[] }; 3?: { teknik: string[] } };
  diperiksa: Partial<Record<1 | 2 | 3, boolean>>;
  durasi: Partial<Record<1 | 2 | 3, number>>;
  keputusan: Keputusan | null;
  selesai: string | null;
  jejak_id: string | null;
  diperbarui: string;
}

export function sesiLokal(id: string): SesiLokal | null {
  return baca<SesiLokal | null>(PREFIX_SESI + id, null);
}
export function simpanSesi(s: SesiLokal) {
  tulis(PREFIX_SESI + s.id, { ...s, diperbarui: new Date().toISOString() });
}
export function sesiLokalAktif(): SesiLokal | null {
  let terbaru: SesiLokal | null = null;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX_SESI)) continue;
    const s = baca<SesiLokal | null>(k, null);
    if (s && s.mode === "latihan" && !s.jejak_id && (!terbaru || s.diperbarui > terbaru.diperbarui)) terbaru = s;
  }
  return terbaru;
}

export function hapusDataPerangkat() {
  const hapus: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("jeda.")) hapus.push(k);
  }
  hapus.forEach((k) => localStorage.removeItem(k));
  navigator.serviceWorker?.controller?.postMessage("hapus-api");
  beritahu();
}

// ------------------------------------------------------------------ jejak (cermin logika server)

export function jejakDariLatihan(k: Kasus, j2: { primer: string | null; pembanding: string[] } | undefined, tanggal: string): Pick<Jejak, "klaim" | "sumber_primer" | "pembanding" | "tanggal_periksa" | "konteks" | "sumber_primer_url" | "pembanding_url"> {
  const by = new Map<string, Sumber>(k.konten.sumber.map((s) => [s.id, s]));
  const primer = j2?.primer ? by.get(j2.primer) : undefined;
  const pemb = (j2?.pembanding ?? []).map((x) => by.get(x)).filter((s): s is Sumber => !!s && s.jenis === "independen");
  return {
    klaim: k.judul,
    sumber_primer: primer?.jenis === "primer" ? primer.teks : "",
    sumber_primer_url: primer?.jenis === "primer" ? primer.url ?? "" : "",
    pembanding: pemb.map((p) => p.teks).join("; "),
    pembanding_url: pemb[0]?.url ?? "",
    tanggal_periksa: tanggal,
    konteks: k.konten.konteks,
  };
}

export function kelengkapan(j: Pick<Jejak, "sumber_primer" | "pembanding" | "tanggal_periksa" | "konteks">) {
  const kurang: string[] = [];
  if (!j.sumber_primer?.trim()) kurang.push("sumber_primer");
  if (!j.pembanding?.trim()) kurang.push("pembanding");
  if (!j.tanggal_periksa) kurang.push("tanggal_periksa");
  if (!j.konteks?.trim()) kurang.push("konteks");
  return { nilai: 4 - kurang.length, kurang };
}

export function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
