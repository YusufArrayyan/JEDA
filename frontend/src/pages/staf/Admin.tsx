import { Download, Play, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorNote, Field, Note, PageTitle } from "../../components/ui";
import { api, unduh } from "../../lib/api";
import { tgl, useApp } from "../../lib/app";

const TABS = [
  { id: "tim", label: "Akun tim" },
  { id: "laporan", label: "Laporan konten" },
  { id: "teknik", label: "Teknik & tema" },
  { id: "audit", label: "Log audit" },
  { id: "data", label: "Ekspor & retensi" },
] as const;

export default function Admin() {
  const [q, setQ] = useSearchParams();
  const tab = (TABS.find((t) => t.id === q.get("bagian"))?.id ?? "tim") as (typeof TABS)[number]["id"];
  const setTab = (id: string) => setQ({ bagian: id }, { replace: true });
  return (
    <div className="stack-lg">
      <PageTitle sub="Kelola peran, moderasi, dan data program. Admin tidak dapat membuka jawaban perseorangan.">Admin program</PageTitle>
      <div className="segmented" role="group" aria-label="Bagian admin" style={{ gridAutoColumns: "minmax(120px, 1fr)", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "tim" && <Tim />}
      {tab === "laporan" && <LaporanKonten />}
      {tab === "teknik" && <TeknikTema />}
      {tab === "audit" && <Audit />}
      {tab === "data" && <DataProgram />}
    </div>
  );
}

const PERAN_LABEL: Record<string, string> = { fasilitator: "Fasilitator", pemeriksa: "Pemeriksa fakta", admin: "Admin" };

function Tim() {
  const { toast, profil } = useApp();
  const [d, setD] = useState<{ staf: { id: string; nama: string; surel: string; peran: string; aktif: boolean }[]; jumlah_peserta: number } | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const [baru, setBaru] = useState({ nama: "", surel: "", peran: "fasilitator", kata_sandi: "" });
  const muat = useCallback(() => api<typeof d>("/api/admin/pengguna").then(setD).catch(setGalat), []);
  useEffect(() => {
    void muat();
  }, [muat]);

  async function ubah(id: string, body: object, pesan: string) {
    try {
      await api(`/api/admin/pengguna/${id}`, { method: "PATCH", body });
      toast(pesan);
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  async function tambah() {
    try {
      await api("/api/admin/pengguna", { method: "POST", body: baru });
      toast("Akun tim dibuat.");
      setBaru({ nama: "", surel: "", peran: "fasilitator", kata_sandi: "" });
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <div className="stack-lg">
      <p className="small muted">{d ? `${d.jumlah_peserta} peserta terdaftar. Akun peserta dikelola oleh peserta sendiri lewat kode ruang.` : ""}</p>
      <ErrorNote error={galat} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Surel</th>
              <th>Peran</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d?.staf.map((u) => (
              <tr key={u.id}>
                <td>{u.nama}</td>
                <td className="caption">{u.surel}</td>
                <td>
                  <select className="select" style={{ minHeight: 40, padding: "6px 10px" }} aria-label={`Peran ${u.nama}`} value={u.peran} disabled={u.id === profil?.id} onChange={(e) => ubah(u.id, { peran: e.target.value }, `Peran ${u.nama} diubah.`)}>
                    {Object.entries(PERAN_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={u.aktif} disabled={u.id === profil?.id} onChange={(e) => ubah(u.id, { aktif: e.target.checked }, e.target.checked ? "Akun diaktifkan." : "Akun dinonaktifkan.")} />
                    {u.aktif ? "Aktif" : "Nonaktif"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void tambah();
        }}
      >
        <h2>Tambah akun tim</h2>
        <div className="grid-2">
          <Field label="Nama" htmlFor="a-nama">
            <input id="a-nama" className="input" value={baru.nama} onChange={(e) => setBaru({ ...baru, nama: e.target.value })} required minLength={2} />
          </Field>
          <Field label="Surel" htmlFor="a-surel">
            <input id="a-surel" className="input" type="email" value={baru.surel} onChange={(e) => setBaru({ ...baru, surel: e.target.value })} required />
          </Field>
          <Field label="Peran" htmlFor="a-peran">
            <select id="a-peran" className="select" value={baru.peran} onChange={(e) => setBaru({ ...baru, peran: e.target.value })}>
              {Object.entries(PERAN_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kata sandi awal" htmlFor="a-pw" help="Minimal 10 karakter. Sampaikan lewat jalur pribadi.">
            <input id="a-pw" className="input" type="password" autoComplete="new-password" value={baru.kata_sandi} onChange={(e) => setBaru({ ...baru, kata_sandi: e.target.value })} required minLength={10} />
          </Field>
        </div>
        <button className="btn primary" style={{ alignSelf: "flex-start" }}>
          <Plus aria-hidden /> Tambah akun
        </button>
      </form>
    </div>
  );
}

interface Lap {
  id: string;
  kasus_judul: string;
  kasus_status: string;
  alasan: string;
  keterangan: string;
  status: string;
  catatan_moderator: string;
  dibuat_pada: string;
}
const ALASAN: Record<string, string> = { kedaluwarsa: "Kedaluwarsa", keliru: "Ada yang keliru", tidak_aman: "Tidak aman", lainnya: "Lainnya" };

function LaporanKonten() {
  const { toast } = useApp();
  const [d, setD] = useState<Lap[] | null>(null);
  const [cat, setCat] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState<unknown>(null);
  const muat = useCallback(() => api<Lap[]>("/api/admin/laporan-konten").then(setD).catch(setGalat), []);
  useEffect(() => {
    void muat();
  }, [muat]);

  async function tindak(l: Lap, keputusan: string) {
    if ((cat[l.id] ?? "").trim().length < 3) {
      setGalat(new Error("Tulis catatan moderasi (minimal 3 huruf) sebelum memutuskan."));
      return;
    }
    try {
      await api(`/api/admin/laporan-konten/${l.id}`, { method: "POST", body: { keputusan, catatan: cat[l.id] } });
      toast("Laporan ditindaklanjuti.");
      setGalat(null);
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  const hariKerja = (iso: string) => {
    let n = 0;
    const d = new Date(iso);
    const now = new Date();
    while (d < now) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() % 6 !== 0) n++;
    }
    return n;
  };

  return (
    <div className="stack">
      <Note>Target tindak lanjut selama pilot: paling lama 2 hari kerja.</Note>
      <ErrorNote error={galat} />
      {d?.length === 0 && <p className="muted">Tidak ada laporan.</p>}
      {d?.map((l) => (
        <article key={l.id} className="card stack-sm">
          <div className="row between wrap">
            <h3>{l.kasus_judul}</h3>
            <div className="row" style={{ gap: 6 }}>
              <span className="badge">{ALASAN[l.alasan] ?? l.alasan}</span>
              <span className={`badge ${l.status === "baru" ? (hariKerja(l.dibuat_pada) > 2 ? "err" : "warn") : "ok"}`}>{l.status === "baru" ? `Baru · ${hariKerja(l.dibuat_pada)} hari kerja` : l.status === "ditolak" ? "Ditolak" : "Ditindak"}</span>
            </div>
          </div>
          {l.keterangan && <p className="small">{l.keterangan}</p>}
          <p className="caption">Dilaporkan {tgl(l.dibuat_pada, true)} · status kasus: {l.kasus_status}</p>
          {l.status === "baru" ? (
            <>
              <Field label="Catatan moderasi" htmlFor={`lc-${l.id}`}>
                <input id={`lc-${l.id}`} className="input" value={cat[l.id] ?? ""} onChange={(e) => setCat({ ...cat, [l.id]: e.target.value })} />
              </Field>
              <div className="row wrap">
                <button type="button" className="btn danger sm" onClick={() => tindak(l, "tarik")}>
                  Tarik kasus
                </button>
                <button type="button" className="btn secondary sm" onClick={() => tindak(l, "tindak")}>
                  Tandai ditindak
                </button>
                <button type="button" className="btn ghost sm" onClick={() => tindak(l, "tolak")}>
                  Tolak laporan
                </button>
              </div>
            </>
          ) : (
            <p className="small muted">Catatan: {l.catatan_moderator}</p>
          )}
        </article>
      ))}
    </div>
  );
}

function TeknikTema() {
  const { toast } = useApp();
  const [d, setD] = useState<{ teknik: { kode: string; nama: string; deskripsi: string; aktif: boolean }[]; tema: { kode: string; nama: string; aktif: boolean }[] } | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const [bt, setBt] = useState({ kode: "", nama: "", deskripsi: "" });
  const muat = useCallback(() => api<typeof d>("/api/admin/teknik").then(setD).catch(setGalat), []);
  useEffect(() => {
    void muat();
  }, [muat]);

  async function simpan(path: string, body: object) {
    try {
      await api(path, { method: "PUT", body });
      toast("Tersimpan. Kasus yang sudah terbit tidak berubah.");
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <div className="stack-lg">
      <Note>Mengubah nama atau menonaktifkan teknik tidak mengubah kasus yang sudah terbit. Perubahan isi kasus tetap melalui pemeriksa fakta.</Note>
      <ErrorNote error={galat} />
      <section className="stack-sm">
        <h2>Teknik manipulasi</h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Deskripsi</th>
                <th>Aktif</th>
              </tr>
            </thead>
            <tbody>
              {d?.teknik.map((t) => (
                <tr key={t.kode}>
                  <td className="mono caption">{t.kode}</td>
                  <td>{t.nama}</td>
                  <td className="small">{t.deskripsi}</td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={t.aktif} onChange={(e) => simpan("/api/admin/teknik", { ...t, aktif: e.target.checked })} />
                      <span className="sr-only">Aktifkan {t.nama}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void simpan("/api/admin/teknik", { ...bt, aktif: true }).then(() => setBt({ kode: "", nama: "", deskripsi: "" }));
          }}
        >
          <h3>Tambah teknik</h3>
          <div className="grid-2">
            <Field label="Kode" htmlFor="t-kode" help="Huruf kecil dan garis bawah, misalnya klaim_ilmiah_palsu.">
              <input id="t-kode" className="input mono" value={bt.kode} pattern="[a-z_]{3,32}" onChange={(e) => setBt({ ...bt, kode: e.target.value })} required />
            </Field>
            <Field label="Nama" htmlFor="t-nama">
              <input id="t-nama" className="input" value={bt.nama} onChange={(e) => setBt({ ...bt, nama: e.target.value })} required />
            </Field>
          </div>
          <Field label="Deskripsi" htmlFor="t-desk">
            <input id="t-desk" className="input" value={bt.deskripsi} onChange={(e) => setBt({ ...bt, deskripsi: e.target.value })} />
          </Field>
          <button className="btn secondary" style={{ alignSelf: "flex-start" }}>
            <Plus aria-hidden /> Tambah teknik
          </button>
        </form>
      </section>
      <section className="stack-sm">
        <h2>Tema</h2>
        <div className="chips">
          {d?.tema.map((t) => (
            <label key={t.kode} className="toggle card tight" style={{ padding: "6px 12px" }}>
              <input type="checkbox" checked={t.aktif} onChange={(e) => simpan("/api/admin/tema", { ...t, aktif: e.target.checked })} />
              {t.nama}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function Audit() {
  const [d, setD] = useState<{ id: number; waktu: string; aktor: string; aksi: string; objek: string; detail: unknown }[] | null>(null);
  const [aksi, setAksi] = useState("");
  const [galat, setGalat] = useState<unknown>(null);
  useEffect(() => {
    api<typeof d>(`/api/admin/audit${aksi ? `?aksi=${aksi}` : ""}`).then(setD).catch(setGalat);
  }, [aksi]);
  return (
    <div className="stack">
      <Note>Log audit hanya bisa ditambah oleh sistem. Tidak ada peran yang dapat mengubah atau menghapusnya.</Note>
      <Field label="Saring aksi" htmlFor="au-aksi">
        <select id="au-aksi" className="select" style={{ maxWidth: 320 }} value={aksi} onChange={(e) => setAksi(e.target.value)}>
          <option value="">Semua aksi</option>
          {["masuk", "peran_diubah", "telaah_terbit", "telaah_ditelaah", "telaah_ditolak", "kasus_terbit", "kasus_ditarik", "ekspor_rekap_csv", "ekspor_anonim", "retensi_dijalankan", "persetujuan_wali_dicatat"].map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>
      <ErrorNote error={galat} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Aktor</th>
              <th>Aksi</th>
              <th>Objek</th>
            </tr>
          </thead>
          <tbody>
            {d?.map((a) => (
              <tr key={a.id}>
                <td className="caption nowrap">{tgl(a.waktu, true)}</td>
                <td>{a.aktor}</td>
                <td>
                  <span className="badge">{a.aksi.replace(/_/g, " ")}</span>
                </td>
                <td className="caption" style={{ overflowWrap: "anywhere" }}>
                  {a.objek}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataProgram() {
  const { toast } = useApp();
  const [galat, setGalat] = useState<unknown>(null);
  const [hasil, setHasil] = useState<{ batas: string; dianonimkan: number; sesi_kedaluwarsa: number } | null>(null);
  return (
    <div className="stack-lg">
      <section className="card stack-sm">
        <h2>Ekspor data anonim</h2>
        <p className="small muted">Untuk analisis pilot. Berisi skor tes, sesi, keputusan berbagi, kelengkapan jejak, dan skor SUS. Tanpa nama samaran, surel, atau teks bebas; peserta diganti nomor urut.</p>
        <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => unduh("/api/admin/ekspor", "ekspor-anonim-jeda.csv").then(() => toast("Ekspor anonim diunduh dan dicatat di log audit.")).catch(setGalat)}>
          <Download aria-hidden /> Unduh ekspor anonim (CSV)
        </button>
      </section>
      <section className="card stack-sm">
        <h2>Kebijakan retensi</h2>
        <p className="small muted">Data perseorangan dianonimkan 90 hari setelah laporan pilot selesai. Tugas ini berjalan otomatis setiap hari dan tercatat di log audit. Kamu bisa menjalankannya sekarang untuk memeriksa.</p>
        <button
          type="button"
          className="btn secondary"
          style={{ alignSelf: "flex-start" }}
          onClick={() =>
            api<typeof hasil>("/api/admin/retensi", { method: "POST" })
              .then(setHasil)
              .catch(setGalat)
          }
        >
          <Play aria-hidden /> Jalankan tugas retensi
        </button>
        {hasil && (
          <Note tone="ok">
            Tugas selesai. Batas anonimisasi {tgl(hasil.batas)}; {hasil.dianonimkan} akun dianonimkan; {hasil.sesi_kedaluwarsa} sesi kedaluwarsa dibersihkan.
          </Note>
        )}
      </section>
      <ErrorNote error={galat} />
    </div>
  );
}
