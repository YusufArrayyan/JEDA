import { Check, CheckCircle2, Inbox, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorNote, Field, Note, PageTitle } from "../../components/ui";
import { api } from "../../lib/api";
import { namaTema, namaTeknik, STATUS_LABEL, STATUS_NADA, tgl, useApp } from "../../lib/app";
import type { Usulan } from "../../lib/types";

const BUTIR = [
  { k: "tanpa_wajah", label: "Tanpa wajah atau suara orang nyata" },
  { k: "tidak_mempermalukan", label: "Tidak mempermalukan korban" },
  { k: "bertanda_simulasi", label: "Bertanda SIMULASI" },
  { k: "tanpa_data_pribadi", label: "Tidak memuat data pribadi" },
];

export default function Telaah() {
  const { profil } = useApp();
  const [daftar, setDaftar] = useState<Usulan[] | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const muat = useCallback(() => api<Usulan[]>("/api/telaah").then(setDaftar).catch(setGalat), []);
  useEffect(() => {
    void muat();
  }, [muat]);

  const tahap = profil?.peran === "pemeriksa" ? "Tahap 2 · pemeriksa fakta" : profil?.peran === "fasilitator" ? "Tahap 1 · fasilitator" : "Moderasi admin";

  return (
    <div className="stack-lg">
      <PageTitle sub={`${tahap}. Telaah setiap usulan dengan daftar periksa keselamatan sebelum meneruskan atau menerbitkan.`}>Telaah usulan</PageTitle>
      <ErrorNote error={galat} />
      {daftar?.length === 0 && <Empty icon={<Inbox aria-hidden />} judul="Antrean telaah kosong">Usulan baru dari peserta akan muncul di sini.</Empty>}
      <div className="stack">
        {daftar?.map((u) => (
          <KartuTelaah key={u.id} u={u} selesai={muat} />
        ))}
      </div>
    </div>
  );
}

function KartuTelaah({ u, selesai }: { u: Usulan; selesai: () => void }) {
  const { konfig, profil, toast } = useApp();
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState<unknown>(null);
  const [perluCatatan, setPerluCatatan] = useState(false);
  const pemeriksa = profil?.peran === "pemeriksa" || (profil?.peran === "admin" && u.status === "ditelaah");
  const aman = BUTIR.every((b) => u.keselamatan?.[b.k]);

  async function putuskan(keputusan: string) {
    if ((keputusan === "tolak" || keputusan === "kembalikan") && !catatan.trim()) {
      setPerluCatatan(true);
      document.getElementById(`cat-${u.id}`)?.focus();
      return;
    }
    try {
      await api(`/api/usulan/${u.id}/telaah`, { method: "POST", body: { keputusan, catatan } });
      toast({ lolos: "Usulan diteruskan ke pemeriksa fakta.", terbit: "Kartu terbit di bank kasus.", tolak: "Usulan ditolak dan pengaju diberi kabar.", kembalikan: "Usulan dikembalikan ke pengaju." }[keputusan] ?? "Keputusan tersimpan.");
      selesai();
    } catch (e) {
      setGalat(e);
    }
  }

  return (
    <article className="card stack">
      <div className="row between wrap">
        <div className="row wrap" style={{ gap: 6 }}>
          <span className={`badge ${STATUS_NADA[u.status]}`}>{STATUS_LABEL[u.status]}</span>
          <span className="badge">{u.jenis === "kasus" ? "Usulan kasus" : "Kartu prebunking"}</span>
          <span className="badge">{namaTeknik(konfig, u.teknik)}</span>
          <span className="badge">{namaTema(konfig, u.tema)}</span>
        </div>
        <span className="caption">Diajukan {tgl(u.dibuat_pada, true)}</span>
      </div>
      <h2>{u.judul}</h2>
      <dl className="kv">
        <dt>Klaim</dt>
        <dd>{u.klaim}</dd>
        <dt>Bukti</dt>
        <dd>{u.bukti}</dd>
        <dt>Pesan</dt>
        <dd style={{ fontWeight: 600 }}>{u.pesan_prebunking}</dd>
      </dl>
      <div className="stack-sm">
        <span className="caption">Daftar periksa keselamatan dari pengaju (periksa ulang isinya)</span>
        <ul className="chips" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {BUTIR.map((b) => (
            <li key={b.k} className={`badge ${u.keselamatan?.[b.k] ? "ok" : "err"}`}>
              {u.keselamatan?.[b.k] ? <Check aria-hidden /> : <X aria-hidden />} {b.label}
            </li>
          ))}
        </ul>
        {!aman && <Note tone="err">Ada butir keselamatan yang belum dicentang. Kembalikan ke pengaju.</Note>}
      </div>
      {u.riwayat && u.riwayat.length > 1 && (
        <ol className="timeline">
          {u.riwayat.map((r, i) => (
            <li key={i}>
              <b style={{ color: "var(--ink)" }}>{STATUS_LABEL[r.ke]}</b> · {r.penelaah} · {tgl(r.waktu, true)}
              {r.catatan && <div className="muted">{r.catatan}</div>}
            </li>
          ))}
        </ol>
      )}
      <Field label="Catatan untuk pengaju" htmlFor={`cat-${u.id}`} help="Wajib bila menolak atau mengembalikan. Tulis apa yang perlu diperbaiki." error={perluCatatan && !catatan.trim() ? "Tulis alasan agar pengaju tahu apa yang perlu diperbaiki." : null}>
        <textarea id={`cat-${u.id}`} className="textarea" style={{ minHeight: 76 }} value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={600} />
      </Field>
      <ErrorNote error={galat} />
      <div className="row wrap">
        {pemeriksa ? (
          <button type="button" className="btn primary" onClick={() => putuskan("terbit")} disabled={!aman}>
            <CheckCircle2 aria-hidden /> Terbitkan
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => putuskan("lolos")} disabled={!aman}>
            <Check aria-hidden /> Teruskan ke pemeriksa fakta
          </button>
        )}
        <button type="button" className="btn secondary" onClick={() => putuskan("kembalikan")}>
          Kembalikan untuk diperbaiki
        </button>
        <button type="button" className="btn ghost" style={{ color: "var(--err)" }} onClick={() => putuskan("tolak")}>
          Tolak
        </button>
      </div>
    </article>
  );
}
