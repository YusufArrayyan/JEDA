import { Archive, CheckCircle2, Flag, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Confirm, ErrorNote, Field, PageTitle } from "../../components/ui";
import { api } from "../../lib/api";
import { namaTema, STATUS_LABEL, STATUS_NADA, tgl, useApp } from "../../lib/app";
import type { KasusRingkas } from "../../lib/types";

export default function KelolaKasus() {
  const { konfig, profil, toast } = useApp();
  const [daftar, setDaftar] = useState<KasusRingkas[] | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const [tarik, setTarik] = useState<KasusRingkas | null>(null);
  const [alasan, setAlasan] = useState("");
  const [saring, setSaring] = useState("");

  const muat = useCallback(() => api<KasusRingkas[]>("/api/kelola/kasus").then(setDaftar).catch(setGalat), []);
  useEffect(() => {
    void muat();
  }, [muat]);

  async function status(k: KasusRingkas, s: string, catatan = "") {
    try {
      await api(`/api/kelola/kasus/${k.id}/status`, { method: "POST", body: { status: s, catatan } });
      toast(s === "terbit" ? "Kasus terbit dan muncul di latihan." : "Kasus diarsipkan dan hilang dari latihan baru.");
      void muat();
    } catch (e) {
      setGalat(e);
    }
  }

  const tampil = (daftar ?? []).filter((k) => !saring || k.status === saring);
  const hariIni = new Date().toISOString().slice(0, 10);

  return (
    <div className="stack-lg">
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <PageTitle sub="Hanya kasus berstatus Terbit yang dipakai di latihan dan tes. Kasus selalu bertanda SIMULASI.">Kelola kasus</PageTitle>
        <Link to="/kelola-kasus/baru" className="btn primary sm">
          <Plus aria-hidden /> Kasus baru
        </Link>
      </div>
      <div className="chips" role="group" aria-label="Saring status">
        {["", "terbit", "ditelaah", "diarsipkan"].map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={saring === s} onClick={() => setSaring(s)}>
            {s ? STATUS_LABEL[s] : "Semua"}
          </button>
        ))}
      </div>
      <ErrorNote error={galat} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Kasus</th>
              <th>Status</th>
              <th>Tinjau ulang</th>
              <th>Laporan</th>
              <th>
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((k) => (
              <tr key={k.id}>
                <td>
                  <b style={{ color: "var(--ink)" }}>{k.judul}</b>
                  <div className="caption">{namaTema(konfig, k.tema)}</div>
                </td>
                <td>
                  <span className={`badge ${STATUS_NADA[k.status]}`}>{STATUS_LABEL[k.status]}</span>
                </td>
                <td className={k.tanggal_tinjau && k.tanggal_tinjau < hariIni ? "" : "caption"} style={k.tanggal_tinjau && k.tanggal_tinjau < hariIni ? { color: "var(--warn)", fontWeight: 600 } : undefined}>
                  {tgl(k.tanggal_tinjau)}
                </td>
                <td>
                  {k.laporan_baru ? (
                    <span className="badge warn">
                      <Flag aria-hidden /> {k.laporan_baru} baru
                    </span>
                  ) : (
                    <span className="caption">–</span>
                  )}
                </td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    <Link to={`/kelola-kasus/${k.id}`} className="btn ghost sm" aria-label={`Ubah ${k.judul}`}>
                      <Pencil aria-hidden /> Ubah
                    </Link>
                    {k.status !== "terbit" && profil?.peran === "pemeriksa" && (
                      <button type="button" className="btn ghost sm" onClick={() => status(k, "terbit")}>
                        <CheckCircle2 aria-hidden /> Terbitkan
                      </button>
                    )}
                    {k.status === "terbit" && (
                      <button type="button" className="btn ghost sm" style={{ color: "var(--err)" }} onClick={() => setTarik(k)}>
                        <Archive aria-hidden /> Tarik
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Confirm
        open={!!tarik}
        judul="Tarik kasus ini?"
        ya="Tarik kasus"
        bahaya
        onYa={() => {
          if (!alasan.trim()) return;
          void status(tarik!, "diarsipkan", alasan);
          setTarik(null);
          setAlasan("");
        }}
        onTidak={() => setTarik(null)}
      >
        <div className="stack-sm" style={{ marginTop: 6 }}>
          <span>“{tarik?.judul}” berstatus Diarsipkan dan hilang dari latihan baru. Riwayat tetap tersimpan.</span>
          <Field label="Alasan penarikan" htmlFor="alasan-tarik" error={!alasan.trim() ? "Wajib diisi." : null}>
            <input id="alasan-tarik" className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} />
          </Field>
        </div>
      </Confirm>
    </div>
  );
}
