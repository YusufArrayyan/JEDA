export class ApiError extends Error {
  status: number;
  code: string;
  hint: string;
  constructor(status: number, code: string, message: string, hint = "") {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

/** Galat jaringan (luring). Dibedakan dari ApiError agar antrean luring bisa mengambil alih. */
export class NetError extends Error {
  constructor() {
    super("Koneksi terputus. Jawabanmu aman di perangkat dan akan terkirim saat sinyal kembali.");
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      credentials: "same-origin",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new NetError();
  }
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "galat", e?.message ?? "Terjadi galat di server.", e?.hint ?? "Coba lagi sebentar lagi.");
  }
  return data as T;
}

/** Unduh berkas (PDF/CSV/JSON) lewat tautan sementara. */
export async function unduh(path: string, nama: string) {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new ApiError(res.status, d?.error?.code ?? "galat", d?.error?.message ?? "Berkas gagal diunduh.", d?.error?.hint ?? "");
  }
  const blob = await res.blob();
  simpanBlob(blob, nama);
}

export function simpanBlob(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pesanGalat(e: unknown): { message: string; hint: string } {
  if (e instanceof ApiError) return { message: e.message, hint: e.hint };
  if (e instanceof NetError) return { message: e.message, hint: "" };
  return { message: "Terjadi galat yang tidak terduga.", hint: "Muat ulang halaman, lalu coba lagi." };
}
