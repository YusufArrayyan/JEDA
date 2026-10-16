import { Copy, Pencil, Share2, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Back, Confirm, ErrorNote, Field, Note, PageTitle, UnsurChips } from "../components/ui";
import { api, NetError } from "../lib/api";
import { labelOpsi, tgl, UNSUR_LABEL, useApp } from "../lib/app";
import { kirim } from "../lib/offline";
import type { Jejak } from "../lib/types";
import { simpanJejakLokal } from "./LatihanSesi";

/** FR-4.5: teks ringkas siap salin, tanpa vonis. */
function teksBagikan(j: Jejak, tindakan: string) {
  const status = [j.sumber_primer ? `sumber primer: ${j.sumber_primer}` : "sumber primer belum ditemukan", j.pembanding ? `pembanding: ${j.pembanding}` : "pembanding independen belum ditemukan"];
  return [
    "Sebelum meneruskan, aku sudah memeriksa pesan ini dengan JEDA.",
    j.klaim ? `Klaim: ${j.klaim}` : null,
    `Status pemeriksaan per ${tgl(j.tanggal_periksa)}: ${status.join("; ")}.`,
    j.konteks ? `Konteks: ${j.konteks}` : null,
    j.sumber_primer_url || j.pembanding_url ? `Sumber: ${[j.sumber_primer_url, j.pembanding_url].filter(Boolean).join(" ")}` : null,
    tindakan ? `Keputusanku: ${tindakan.toLowerCase()}.` : null,
    "Ini catatan pemeriksaan, bukan vonis benar atau salah. Cek sendiri sumbernya ya.",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function JejakDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { konfig, toast } = useApp();
  const [j, setJ] = useState<Jejak | null>(null);
  const [galat, setGalat] = useState<unknown>(null);
  const [hapus, setHapus] = useState(false);
  const [ubah, setUbah] = useState(false);
  const [draf, setDraf] = useState<Partial<Jejak>>({});

  useEffect(() => {
    api<Jejak>(`/api/jejak/${id}`)
      .then(setJ)
      .catch((e) => {
        const lokal = localStorage.getItem(`jeda.jejak.${id}`);
        if (lokal && (e instanceof NetError || e?.status === 404)) setJ(JSON.parse(lokal));
        else setGalat(e);
      });
  }, [id]);

  if (galat) {
    return (
      <div className="stack">
        <Back to="/jejak" />
        <ErrorNote error={galat} />
      </div>
    );
  }
  if (!j) return <p className="muted" role="status">Memuat jejak…</p>;

  const tindakan = labelOpsi(konfig?.jeda.tindakan, j.tindakan);
  const bagikan = teksBagikan(j, j.tindakan ? tindakan : "");

  async function simpan() {
    if (!j) return;
    const now = new Date().toISOString();
    const isi = { ...j, ...draf };
    try {
      const r = await kirim<Jejak>("PUT", "/api/jejak", {
        id: j.id,
        sesi_id: j.sesi_id,
        klaim: isi.klaim,
        sumber_primer: isi.sumber_primer,
        sumber_primer_url: isi.sumber_primer_url,
        pembanding: isi.pembanding,
        pembanding_url: isi.pembanding_url,
        tanggal_periksa: isi.tanggal_periksa,
        konteks: isi.konteks,
        catatan: isi.catatan,
        diperbarui_pada: now,
      });
      const baru = r ?? { ...isi, antre: true };
      setJ(baru);
      simpanJejakLokal(baru);
      setUbah(false);
      setDraf({});
      toast("Perubahan tersimpan.");
    } catch (e) {
      setGalat(e);
    }
  }

  async function hapusJejak() {
    try {
      await kirim("DELETE", `/api/jejak/${j!.id}`);
      localStorage.removeItem(`jeda.jejak.${j!.id}`);
      toast("1 jejak dihapus.");
      nav("/jejak", { replace: true });
    } catch (e) {
      setGalat(e);
    }
  }

  const v = { ...j, ...draf };
  const set = (k: keyof Jejak) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraf((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="stack-lg">
      <Back to="/jejak" label="Semua jejak" />
      <div className="stack-sm">
        <div className="row wrap" style={{ gap: 8 }}>
          <span className={`badge ${j.mode === "cek" ? "brand" : ""}`}>{j.mode === "cek" ? "Cek JEDA" : "Latihan"}</span>
          <span className={`badge ${j.kelengkapan === 4 ? "ok" : "warn"}`}>{j.kelengkapan === 4 ? "Jejak lengkap" : `${j.kelengkapan} dari 4 unsur`}</span>
          {j.antre && <span className="badge warn">Belum terkirim</span>}
        </div>
        <PageTitle sub={`Diperiksa ${tgl(j.tanggal_periksa)}`}>{j.klaim || "Jejak tanpa teks klaim"}</PageTitle>
      </div>

      {!ubah ? (
        <div className="card stack">
          <dl className="kv">
            <dt>Klaim</dt>
            <dd className={j.klaim ? "" : "kosong"}>{j.klaim || "Tidak disimpan"}</dd>
            <dt>Sumber primer</dt>
            <dd className={j.sumber_primer ? "" : "kosong"}>
              {j.sumber_primer || "Belum diisi"}
              {j.sumber_primer_url && (
                <>
                  {" "}
                  <a href={j.sumber_primer_url} target="_blank" rel="noopener noreferrer">
                    buka
                  </a>
                </>
              )}
            </dd>
            <dt>Pembanding</dt>
            <dd className={j.pembanding ? "" : "kosong"}>
              {j.pembanding || "Belum diisi"}
              {j.pembanding_url && (
                <>
                  {" "}
                  <a href={j.pembanding_url} target="_blank" rel="noopener noreferrer">
                    buka
                  </a>
                </>
              )}
            </dd>
            <dt>Tanggal periksa</dt>
            <dd>{tgl(j.tanggal_periksa)}</dd>
            <dt>Konteks</dt>
            <dd className={j.konteks ? "" : "kosong"}>{j.konteks || "Belum diisi"}</dd>
            <dt>Keputusan</dt>
            <dd>{j.tindakan ? tindakan : "–"}</dd>
            {j.catatan && (
              <>
                <dt>Catatan</dt>
                <dd>{j.catatan}</dd>
              </>
            )}
          </dl>
          <UnsurChips kurang={j.kurang} />
        </div>
      ) : (
        <div className="card stack">
          {j.mode === "cek" && (
            <>
              <Field label="Klaim" htmlFor="e-kl">
                <textarea id="e-kl" className="textarea" style={{ minHeight: 88 }} value={v.klaim} onChange={set("klaim")} maxLength={1000} />
              </Field>
              <Field label="Sumber primer" htmlFor="e-sp">
                <input id="e-sp" className="input" value={v.sumber_primer} onChange={set("sumber_primer")} />
              </Field>
              <Field label="Pembanding independen" htmlFor="e-pb">
                <input id="e-pb" className="input" value={v.pembanding} onChange={set("pembanding")} />
              </Field>
              <Field label="Tanggal pemeriksaan" htmlFor="e-tg">
                <input id="e-tg" className="input" type="date" value={v.tanggal_periksa ?? ""} onChange={set("tanggal_periksa")} />
              </Field>
              <Field label="Konteks klaim" htmlFor="e-kt">
                <textarea id="e-kt" className="textarea" style={{ minHeight: 88 }} value={v.konteks} onChange={set("konteks")} />
              </Field>
            </>
          )}
          <Field label="Catatan" htmlFor="e-ct" help={j.mode === "latihan" ? "Isi jejak latihan tersusun dari jawaban tahapmu. Kamu bisa menambah catatan." : undefined}>
            <textarea id="e-ct" className="textarea" style={{ minHeight: 88 }} value={v.catatan} onChange={set("catatan")} maxLength={600} />
          </Field>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => { setUbah(false); setDraf({}); }}>
              Batal
            </button>
            <button type="button" className="btn primary" style={{ flex: 1 }} onClick={simpan}>
              Simpan perubahan
            </button>
          </div>
        </div>
      )}

      {j.kurang.length > 0 && !ubah && (
        <Note tone="warn">
          Jejak belum lengkap: {j.kurang.map((k) => UNSUR_LABEL[k]?.toLowerCase()).join(", ")} belum ada.{" "}
          {j.mode === "latihan" ? "Ulangi tahap 2 di latihan berikutnya untuk melengkapinya." : "Pilih Ubah jejak untuk melengkapinya."}
        </Note>
      )}

      <section className="card soft stack-sm" aria-labelledby="bagikan">
        <div className="row">
          <Share2 aria-hidden size={20} style={{ color: "var(--brand)" }} />
          <h2 id="bagikan">Bagikan dengan konteks</h2>
        </div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", font: "inherit", fontSize: 14, background: "#fff", border: "1px solid var(--hair)", borderRadius: 10, padding: 14 }}>{bagikan}</pre>
        <button
          type="button"
          className="btn secondary block"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(bagikan);
              toast("Teks tersalin.");
            } catch {
              toast("Salin otomatis tidak didukung; tekan lama teksnya untuk menyalin.");
            }
          }}
        >
          <Copy aria-hidden /> Salin
        </button>
      </section>

      <ErrorNote error={galat} />
      {!ubah && (
        <div className="row">
          <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setUbah(true)}>
            <Pencil aria-hidden /> Ubah jejak
          </button>
          <button type="button" className="btn ghost" style={{ color: "var(--err)" }} onClick={() => setHapus(true)}>
            <Trash2 aria-hidden /> Hapus
          </button>
        </div>
      )}
      <Confirm open={hapus} judul="Hapus 1 jejak?" ya="Hapus jejak" bahaya onYa={hapusJejak} onTidak={() => setHapus(false)}>
        Jejak yang dihapus tidak bisa dikembalikan.
      </Confirm>
    </div>
  );
}
