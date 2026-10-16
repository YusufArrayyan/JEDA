import { Copy, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Confirm, ErrorNote, Field, Note, PageTitle } from "../../components/ui";
import { api } from "../../lib/api";
import { tgl, useApp } from "../../lib/app";
import { hariIni } from "../../lib/offline";
import type { Ruang } from "../../lib/types";

interface Anggota {
  keanggotaan_id: string;
  nama_samaran: string;
  persetujuan_data: boolean;
  di_bawah_18: boolean;
  wali_disetujui: boolean;
  bergabung_pada: string;
}
interface Rekap {
  id: string;
  tanggal: string;
  jumlah_peserta: number;
  latihan_selesai: number;
  jejak_lengkap: number;
  kasus_dipakai: string;
}

export default function KelolaRuang() {
  const { toast, profil } = useApp();
  const [ruang, setRuang] = useState<Ruang[] | null>(null);
  const [pilih, setPilih] = useState<string>("");
  const [galat, setGalat] = useState<unknown>(null);
  const [baru, setBaru] = useState({ nama: "", wilayah: "Kota Bengkulu", jenis_lembaga: "sekolah", pembanding: false });
  const [buat, setBuat] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await api<Ruang[]>("/api/ruang");
      setRuang(r);
      setPilih((p) => p || r[0]?.id || "");
    } catch (e) {
      setGalat(e);
    }
  }, []);
  useEffect(() => {
    void muat();
  }, [muat]);

  const r = ruang?.find((x) => x.id === pilih);

  async function ubah(body: Partial<Ruang>, pesan: string) {
    try {
      await api(`/api/ruang/${pilih}`, { method: "PATCH", body });
      toast(pesan);
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  async function buatRuang() {
    try {
      const x = await api<Ruang>("/api/ruang", { method: "POST", body: baru });
      toast(`Ruang dibuat. Kode: ${x.kode}`);
      setBuat(false);
      setBaru({ ...baru, nama: "" });
      setPilih(x.id);
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <div className="stack-lg">
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <PageTitle sub={profil?.peran === "admin" ? "Sebagai admin, kamu melihat semua ruang." : "Satu ruang untuk sekitar 20 peserta."}>Kelola ruang</PageTitle>
        <button type="button" className="btn secondary sm" onClick={() => setBuat((b) => !b)} aria-expanded={buat}>
          <Plus aria-hidden /> Ruang baru
        </button>
      </div>
      <ErrorNote error={galat} />
      {buat && (
        <div className="card stack">
          <h2>Ruang baru</h2>
          <div className="grid-2">
            <Field label="Nama ruang" htmlFor="rb-nama">
              <input id="rb-nama" className="input" value={baru.nama} onChange={(e) => setBaru({ ...baru, nama: e.target.value })} />
            </Field>
            <Field label="Wilayah" htmlFor="rb-wil">
              <input id="rb-wil" className="input" value={baru.wilayah} onChange={(e) => setBaru({ ...baru, wilayah: e.target.value })} />
            </Field>
            <Field label="Jenis lembaga" htmlFor="rb-jenis">
              <select id="rb-jenis" className="select" value={baru.jenis_lembaga} onChange={(e) => setBaru({ ...baru, jenis_lembaga: e.target.value })}>
                <option value="sekolah">Sekolah</option>
                <option value="kampus">Kampus</option>
                <option value="perpustakaan">Perpustakaan</option>
                <option value="taman_baca">Taman baca</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </Field>
            <label className="toggle" style={{ alignSelf: "end" }}>
              <input type="checkbox" checked={baru.pembanding} onChange={(e) => setBaru({ ...baru, pembanding: e.target.checked })} />
              Ruang pembanding (hanya tes)
            </label>
          </div>
          <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={buatRuang} disabled={baru.nama.trim().length < 3}>
            Buat ruang dan kode
          </button>
        </div>
      )}

      {ruang && ruang.length > 0 && (
        <div className="segmented" role="group" aria-label="Pilih ruang" style={{ gridAutoColumns: "minmax(140px, 1fr)", overflowX: "auto" }}>
          {ruang.map((x) => (
            <button key={x.id} type="button" aria-pressed={x.id === pilih} onClick={() => setPilih(x.id)}>
              {x.nama}
            </button>
          ))}
        </div>
      )}

      {r && <DetailRuang key={r.id} r={r} ubah={ubah} muat={muat} />}
    </div>
  );
}

function DetailRuang({ r, ubah, muat }: { r: Ruang; ubah: (b: Partial<Ruang>, pesan: string) => Promise<void>; muat: () => Promise<void> }) {
  const { toast } = useApp();
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [rekap, setRekap] = useState<Rekap[]>([]);
  const [galat, setGalat] = useState<unknown>(null);
  const [kodeUlang, setKodeUlang] = useState(false);
  const [form, setForm] = useState({ tanggal: hariIni(), jumlah_peserta: "", latihan_selesai: "", jejak_lengkap: "", kasus_dipakai: "" });

  const muatDetail = useCallback(() => {
    api<Anggota[]>(`/api/ruang/${r.id}/persetujuan`).then(setAnggota).catch(setGalat);
    api<Rekap[]>(`/api/ruang/${r.id}/luring`).then(setRekap).catch(setGalat);
  }, [r.id]);
  useEffect(muatDetail, [muatDetail]);

  async function wali(a: Anggota, v: boolean) {
    try {
      await api(`/api/ruang/${r.id}/wali/${a.keanggotaan_id}`, { method: "POST", body: { disetujui: v } });
      toast(v ? `Persetujuan wali ${a.nama_samaran} dicatat.` : `Catatan wali ${a.nama_samaran} dibatalkan.`);
      muatDetail();
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  async function simpanRekap() {
    try {
      await api(`/api/ruang/${r.id}/luring`, {
        method: "POST",
        body: { ...form, jumlah_peserta: Number(form.jumlah_peserta), latihan_selesai: Number(form.latihan_selesai), jejak_lengkap: Number(form.jejak_lengkap) },
      });
      toast("Rekap luring tersimpan.");
      setForm({ ...form, jumlah_peserta: "", latihan_selesai: "", jejak_lengkap: "", kasus_dipakai: "" });
      muatDetail();
    } catch (e) {
      setGalat(e);
    }
  }

  async function buatKodeUlang() {
    setKodeUlang(false);
    try {
      await api(`/api/ruang/${r.id}/kode-baru`, { method: "POST" });
      toast("Kode baru dibuat. Kode lama tidak berlaku lagi.");
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <div className="stack-lg">
      <div className="grid-auto">
        <div className="card stack-sm">
          <span className="caption">Kode ruang</span>
          <div className="row between">
            <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>
              {r.kode}
            </span>
            <button
              type="button"
              className="iconbtn"
              aria-label="Salin kode ruang"
              onClick={async () => {
                await navigator.clipboard?.writeText(r.kode).catch(() => undefined);
                toast("Kode ruang tersalin.");
              }}
            >
              <Copy size={18} aria-hidden />
            </button>
          </div>
          <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setKodeUlang(true)}>
            <RefreshCw aria-hidden /> Buat ulang kode
          </button>
        </div>
        <div className="card stack-sm">
          <span className="caption">Status ruang</span>
          <label className="toggle">
            <input type="checkbox" checked={r.aktif} onChange={(e) => ubah({ aktif: e.target.checked }, e.target.checked ? "Ruang dibuka." : "Ruang ditutup. Kode tidak bisa dipakai bergabung.")} />
            Ruang aktif
          </label>
          <label className="toggle">
            <input type="checkbox" checked={r.pembanding} onChange={(e) => ubah({ pembanding: e.target.checked }, "Jenis ruang diubah.")} />
            Ruang pembanding
          </label>
        </div>
        <div className="card stack-sm">
          <span className="caption">Jendela tes</span>
          <label className="toggle">
            <input type="checkbox" checked={r.tes_awal_buka} onChange={(e) => ubah({ tes_awal_buka: e.target.checked }, e.target.checked ? "Tes awal dibuka." : "Tes awal ditutup.")} />
            Tes awal dibuka
          </label>
          <label className="toggle">
            <input type="checkbox" checked={r.tes_akhir_buka} onChange={(e) => ubah({ tes_akhir_buka: e.target.checked }, e.target.checked ? "Tes akhir dibuka." : "Tes akhir ditutup.")} />
            Tes akhir dibuka
          </label>
        </div>
      </div>
      <ErrorNote error={galat} />

      <section className="stack-sm" aria-labelledby="h-wali">
        <div className="section-title">
          <h2 id="h-wali">Persetujuan peserta</h2>
          <span className="caption">{anggota.length} peserta</span>
        </div>
        <p className="small muted">Kamu hanya melihat status persetujuan, bukan jawaban atau jejak peserta. Peserta di bawah 18 tahun tanpa persetujuan wali tidak masuk analisis.</p>
        {r.menunggu_wali > 0 && <Note tone="warn">{r.menunggu_wali} peserta di bawah 18 tahun menunggu persetujuan orang tua atau wali.</Note>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nama samaran</th>
                <th>Persetujuan data</th>
                <th>Usia</th>
                <th>Persetujuan wali</th>
                <th>Bergabung</th>
              </tr>
            </thead>
            <tbody>
              {anggota.map((a) => (
                <tr key={a.keanggotaan_id}>
                  <td>{a.nama_samaran}</td>
                  <td>{a.persetujuan_data ? <span className="badge ok">Setuju</span> : <span className="badge">Belum</span>}</td>
                  <td>{a.di_bawah_18 ? "< 18" : "≥ 18"}</td>
                  <td>
                    {a.di_bawah_18 ? (
                      <label className="toggle">
                        <input type="checkbox" checked={a.wali_disetujui} onChange={(e) => wali(a, e.target.checked)} />
                        <span className="sr-only">Persetujuan wali {a.nama_samaran}</span>
                        {a.wali_disetujui ? "Dicatat" : "Belum"}
                      </label>
                    ) : (
                      <span className="caption">Tidak perlu</span>
                    )}
                  </td>
                  <td className="caption">{tgl(a.bergabung_pada)}</td>
                </tr>
              ))}
              {anggota.length === 0 && (
                <tr>
                  <td colSpan={5} className="caption">
                    Belum ada peserta. Bagikan kode ruang {r.kode} ke kelompokmu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack-sm" aria-labelledby="h-luring">
        <h2 id="h-luring">Rekap luring</h2>
        <p className="small muted">Untuk sesi dengan kartu cetak. Isi angka gabungan saja, tanpa nama peserta.</p>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void simpanRekap();
          }}
        >
          <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            <Field label="Tanggal sesi" htmlFor="rl-tg">
              <input id="rl-tg" className="input" type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} required />
            </Field>
            <Field label="Jumlah peserta" htmlFor="rl-n">
              <input id="rl-n" className="input" type="number" inputMode="numeric" min={1} value={form.jumlah_peserta} onChange={(e) => setForm({ ...form, jumlah_peserta: e.target.value })} required />
            </Field>
            <Field label="Latihan selesai" htmlFor="rl-ls">
              <input id="rl-ls" className="input" type="number" inputMode="numeric" min={0} value={form.latihan_selesai} onChange={(e) => setForm({ ...form, latihan_selesai: e.target.value })} required />
            </Field>
            <Field label="Jejak lengkap" htmlFor="rl-jl">
              <input id="rl-jl" className="input" type="number" inputMode="numeric" min={0} value={form.jejak_lengkap} onChange={(e) => setForm({ ...form, jejak_lengkap: e.target.value })} required />
            </Field>
          </div>
          <Field label="Kasus yang dipakai (opsional)" htmlFor="rl-k">
            <input id="rl-k" className="input" value={form.kasus_dipakai} onChange={(e) => setForm({ ...form, kasus_dipakai: e.target.value })} />
          </Field>
          <button className="btn primary" style={{ alignSelf: "flex-start" }}>
            Simpan rekap
          </button>
        </form>
        {rekap.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th className="num">Peserta</th>
                  <th className="num">Latihan selesai</th>
                  <th className="num">Jejak lengkap</th>
                  <th>Kasus</th>
                </tr>
              </thead>
              <tbody>
                {rekap.map((x) => (
                  <tr key={x.id}>
                    <td>{tgl(x.tanggal)}</td>
                    <td className="num">{x.jumlah_peserta}</td>
                    <td className="num">{x.latihan_selesai}</td>
                    <td className="num">{x.jejak_lengkap}</td>
                    <td>{x.kasus_dipakai || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Confirm open={kodeUlang} judul="Buat ulang kode ruang?" ya="Buat kode baru" onYa={buatKodeUlang} onTidak={() => setKodeUlang(false)}>
        Kode {r.kode} langsung tidak berlaku. Peserta yang sudah bergabung tetap di ruang ini.
      </Confirm>
    </div>
  );
}
