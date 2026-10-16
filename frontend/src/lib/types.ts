export type Peran = "peserta" | "fasilitator" | "pemeriksa" | "admin";

export interface Profil {
  id: string;
  nama_samaran: string;
  peran: Peran;
  surel: string | null;
  ruang: { id: string; nama: string; kode: string | null; wilayah: string; pembanding: boolean; tes_awal_buka: boolean; tes_akhir_buka: boolean } | null;
  persetujuan: boolean;
  di_bawah_18: boolean;
  wali_disetujui: boolean;
  tes: Partial<Record<"awal" | "akhir", { skor_akurasi: number; skor_niat_berbagi: number; selesai_pada: string }>>;
  latihan_terkunci: boolean;
  sus_selesai: boolean;
  notifikasi_baru: number;
}

export interface Opsi {
  kode: string;
  label: string;
  keterangan?: string;
}

export interface Konfigurasi {
  mode_uji: boolean;
  cek_maks: number;
  teknik: { kode: string; nama: string; deskripsi: string }[];
  tema: { kode: string; nama: string }[];
  jeda: { q_bukti: Opsi[]; q_untung: Opsi[]; q_akibat: Opsi[]; tindakan: Opsi[]; niat: { nilai: number; label: string }[] };
  label_asesmen: Opsi[];
  sus: string[];
}

export interface Petunjuk {
  id: string;
  teks: string;
  tepat: boolean;
  alasan: string;
}
export interface Sumber {
  id: string;
  teks: string;
  jenis: "primer" | "independen" | "bukan_independen" | "bukan_sumber";
  alasan: string;
  url?: string;
}

export interface KasusRingkas {
  id: string;
  judul: string;
  ringkasan: string;
  tema: string;
  teknik: string[];
  format: "pesan" | "unggahan" | "surat" | "gambar";
  tanggal_beredar: string | null;
  tanggal_tinjau: string | null;
  status: string;
  pesan_prebunking: string;
  sudah_dilatih?: boolean;
  laporan_baru?: number;
}

export interface Kasus extends KasusRingkas {
  klaim: string;
  konten: { petunjuk: Petunjuk[]; kata_kunci: string[]; sumber: Sumber[]; pola: string; konteks: string };
}

export interface Keputusan {
  q_bukti: string;
  q_untung: string;
  q_akibat: string;
  tindakan: string;
  niat: number;
}

export interface Jejak {
  id: string;
  sesi_id: string | null;
  mode: "latihan" | "cek";
  klaim: string;
  sumber_primer: string;
  sumber_primer_url: string;
  pembanding: string;
  pembanding_url: string;
  tanggal_periksa: string | null;
  konteks: string;
  tindakan: string;
  catatan: string;
  kelengkapan: number;
  kurang: string[];
  dibuat_pada: string;
  diperbarui_pada: string;
  /** Hanya di perangkat: belum terkirim ke server. */
  antre?: boolean;
}

export interface Usulan {
  id: string;
  jenis: "kasus" | "kartu";
  judul: string;
  klaim: string;
  teknik: string;
  tema: string;
  bukti: string;
  pesan_prebunking: string;
  status: string;
  dibuat_pada: string;
  diperbarui_pada: string;
  keselamatan?: Record<string, boolean>;
  riwayat?: { tahap: string; dari: string; ke: string; penelaah: string; catatan: string; waktu: string }[];
}

export interface Metrik<T = number | null> {
  nilai: T | null;
  n: number | null;
  tertutup: boolean;
  target: string;
  [k: string]: unknown;
}

export interface Ringkasan {
  peserta_terdaftar: Metrik;
  peserta_aktif: Metrik;
  k1: Metrik & { awal: number | null; akhir: number | null };
  k2: Metrik & { awal: number | null; akhir: number | null };
  k3: Metrik & { lengkap: number | null };
  p1: Metrik;
  p2: Metrik;
  p3: Metrik;
  p4: Metrik & { terbit: number | null };
  p5: Metrik;
  luring: Metrik<{ peserta: number; latihan_selesai: number; jejak_lengkap: number; sesi: number }>;
  k_min: number;
}

export interface Ruang {
  id: string;
  nama: string;
  kode: string;
  wilayah: string;
  jenis_lembaga: string;
  aktif: boolean;
  pembanding: boolean;
  tes_awal_buka: boolean;
  tes_akhir_buka: boolean;
  fasilitator: { id: string; nama: string } | null;
  jumlah_peserta: number;
  menunggu_wali: number;
}
