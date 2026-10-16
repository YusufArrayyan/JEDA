import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Back, ErrorNote, Field, Note, PageTitle, useJagaIsian } from "../../components/ui";
import { api } from "../../lib/api";
import { STATUS_LABEL, tgl, useApp } from "../../lib/app";
import type { Kasus, Petunjuk, Sumber } from "../../lib/types";

type P = Omit<Petunjuk, "id">;
type S = Omit<Sumber, "id">;

const KOSONG = {
  judul: "",
  ringkasan: "",
  klaim: "",
  format: "pesan" as Kasus["format"],
  tema: "",
  teknik: [] as string[],
  tanggal_beredar: "",
  tanggal_tinjau: "",
  kata_kunci: ["", "", ""],
  petunjuk: Array.from({ length: 6 }, (_, i): P => ({ teks: "", tepat: i < 3, alasan: "" })),
  sumber: [
    { teks: "", jenis: "primer", alasan: "", url: "" },
    { teks: "", jenis: "independen", alasan: "", url: "" },
    { teks: "", jenis: "bukan_independen", alasan: "", url: "" },
    { teks: "", jenis: "bukan_sumber", alasan: "", url: "" },
  ] as S[],
  pola: "",
  konteks: "",
  pesan_prebunking: "",
};

export default function EditorKasus() {
  const { id } = useParams();
  const baru = id === "baru";
  const nav = useNavigate();
  const { konfig, toast } = useApp();
  const [f, setF] = useState(KOSONG);
  const [status, setStatus] = useState<string>("ditelaah");
  const [riwayat, setRiwayat] = useState<{ ke: string; penelaah: string; catatan: string; waktu: string }[]>([]);
  const [galat, setGalat] = useState<unknown>(null);
  const [kotor, setKotor] = useState(false);
  const lepas = useJagaIsian(kotor);

  useEffect(() => {
    if (baru) return;
    api<Kasus & { riwayat: typeof riwayat }>(`/api/kelola/kasus/${id}`)
      .then((k) => {
        setStatus(k.status);
        setRiwayat(k.riwayat);
        setF({
          judul: k.judul,
          ringkasan: k.ringkasan,
          klaim: k.klaim,
          format: k.format,
          tema: k.tema,
          teknik: k.teknik,
          tanggal_beredar: k.tanggal_beredar ?? "",
          tanggal_tinjau: k.tanggal_tinjau ?? "",
          kata_kunci: k.konten.kata_kunci,
          petunjuk: k.konten.petunjuk.map(({ teks, tepat, alasan }) => ({ teks, tepat, alasan })),
          sumber: k.konten.sumber.map(({ teks, jenis, alasan, url }) => ({ teks, jenis, alasan, url: url ?? "" })),
          pola: k.konten.pola,
          konteks: k.konten.konteks,
          pesan_prebunking: k.pesan_prebunking,
        });
      })
      .catch(setGalat);
  }, [id, baru]);

  const nTepat = f.petunjuk.filter((p) => p.tepat).length;

  async function simpan() {
    setGalat(null);
    const body = { ...f, tanggal_beredar: f.tanggal_beredar || null, tanggal_tinjau: f.tanggal_tinjau || null, kata_kunci: f.kata_kunci.filter((k) => k.trim()) };
    try {
      await api(baru ? "/api/kelola/kasus" : `/api/kelola/kasus/${id}`, { method: baru ? "POST" : "PUT", body });
      lepas();
      toast(baru ? "Kasus disimpan dengan status Ditelaah." : "Perubahan kasus tersimpan.");
      nav("/kelola-kasus");
    } catch (e) {
      setGalat(e);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setKotor(true);
    setF((x) => ({ ...x, [k]: v }));
  };

  return (
    <div className="stack-lg">
      <Back to="/kelola-kasus" label="Kelola kasus" />
      <PageTitle sub={baru ? "Kasus baru tersimpan sebagai Ditelaah. Pemeriksa fakta menerbitkannya setelah divalidasi." : `Status: ${STATUS_LABEL[status]}. Perubahan pada kasus terbit langsung dipakai latihan baru.`}>{baru ? "Kasus baru" : f.judul || "Ubah kasus"}</PageTitle>
      <Note tone="brand">Kasus selalu bertanda SIMULASI. Jangan memuat wajah, suara, nama orang nyata, atau petunjuk cara membuat konten palsu.</Note>

      <section className="card stack">
        <h2>Identitas kasus</h2>
        <div className="grid-2">
          <Field label="Judul" htmlFor="k-judul">
            <input id="k-judul" className="input" value={f.judul} onChange={(e) => set("judul", e.target.value)} />
          </Field>
          <Field label="Format klaim" htmlFor="k-format">
            <select id="k-format" className="select" value={f.format} onChange={(e) => set("format", e.target.value as Kasus["format"])}>
              <option value="pesan">Pesan berantai</option>
              <option value="unggahan">Unggahan media sosial</option>
              <option value="surat">Gambar surat</option>
              <option value="gambar">Gambar atau video</option>
            </select>
          </Field>
          <Field label="Tema" htmlFor="k-tema">
            <select id="k-tema" className="select" value={f.tema} onChange={(e) => set("tema", e.target.value)}>
              <option value="">Pilih tema</option>
              {konfig?.tema.map((t) => (
                <option key={t.kode} value={t.kode}>
                  {t.nama}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Mulai beredar" htmlFor="k-tb">
              <input id="k-tb" className="input" type="date" value={f.tanggal_beredar} onChange={(e) => set("tanggal_beredar", e.target.value)} />
            </Field>
            <Field label="Tinjau ulang" htmlFor="k-tt">
              <input id="k-tt" className="input" type="date" value={f.tanggal_tinjau} onChange={(e) => set("tanggal_tinjau", e.target.value)} />
            </Field>
          </div>
        </div>
        <Field label="Ringkasan" htmlFor="k-ring">
          <textarea id="k-ring" className="textarea" style={{ minHeight: 80 }} value={f.ringkasan} onChange={(e) => set("ringkasan", e.target.value)} />
        </Field>
        <Field label="Teks klaim (tampil bertanda SIMULASI)" htmlFor="k-klaim">
          <textarea id="k-klaim" className="textarea" value={f.klaim} onChange={(e) => set("klaim", e.target.value)} />
        </Field>
        <Field label="Konteks beredar" htmlFor="k-kt" help="Masuk ke Jejak Verifikasi peserta.">
          <input id="k-kt" className="input" value={f.konteks} onChange={(e) => set("konteks", e.target.value)} />
        </Field>
      </section>

      <section className="card stack">
        <h2>Tahap 1 · Petunjuk asal-usul</h2>
        <p className="small muted">Tandai tepat tiga petunjuk yang benar; sisanya pengecoh. Saat ini: {nTepat} tepat.</p>
        {f.petunjuk.map((p, i) => (
          <div key={i} className="card soft tight stack-sm">
            <div className="row between">
              <b style={{ color: "var(--ink)" }}>Petunjuk {i + 1}</b>
              <div className="row">
                <label className="toggle">
                  <input type="checkbox" checked={p.tepat} onChange={(e) => set("petunjuk", f.petunjuk.map((x, j) => (j === i ? { ...x, tepat: e.target.checked } : x)))} />
                  Tepat
                </label>
                {f.petunjuk.length > 4 && (
                  <button type="button" className="iconbtn" aria-label={`Hapus petunjuk ${i + 1}`} onClick={() => set("petunjuk", f.petunjuk.filter((_, j) => j !== i))}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
            </div>
            <input className="input" aria-label={`Teks petunjuk ${i + 1}`} value={p.teks} onChange={(e) => set("petunjuk", f.petunjuk.map((x, j) => (j === i ? { ...x, teks: e.target.value } : x)))} />
            <input className="input" aria-label={`Alasan petunjuk ${i + 1}`} placeholder="Alasan singkat (umpan balik)" value={p.alasan} onChange={(e) => set("petunjuk", f.petunjuk.map((x, j) => (j === i ? { ...x, alasan: e.target.value } : x)))} />
          </div>
        ))}
        {f.petunjuk.length < 8 && (
          <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => set("petunjuk", [...f.petunjuk, { teks: "", tepat: false, alasan: "" }])}>
            <Plus aria-hidden /> Tambah petunjuk
          </button>
        )}
      </section>

      <section className="card stack">
        <h2>Tahap 2 · Baca menyamping</h2>
        <Field label="Kata kunci pencarian (maks. 5)" htmlFor="k-kw0">
          <div className="stack-sm">
            {f.kata_kunci.map((k, i) => (
              <input key={i} id={`k-kw${i}`} className="input" aria-label={`Kata kunci ${i + 1}`} value={k} onChange={(e) => set("kata_kunci", f.kata_kunci.map((x, j) => (j === i ? e.target.value : x)))} />
            ))}
          </div>
        </Field>
        {f.kata_kunci.length < 5 && (
          <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => set("kata_kunci", [...f.kata_kunci, ""])}>
            <Plus aria-hidden /> Tambah kata kunci
          </button>
        )}
        <p className="small muted">Tepat satu sumber primer dan sedikitnya satu pembanding independen.</p>
        {f.sumber.map((s, i) => (
          <div key={i} className="card soft tight stack-sm">
            <div className="row between wrap">
              <b style={{ color: "var(--ink)" }}>Sumber {i + 1}</b>
              <div className="row">
                <select className="select" style={{ width: "auto" }} aria-label={`Jenis sumber ${i + 1}`} value={s.jenis} onChange={(e) => set("sumber", f.sumber.map((x, j) => (j === i ? { ...x, jenis: e.target.value as S["jenis"] } : x)))}>
                  <option value="primer">Sumber primer</option>
                  <option value="independen">Pembanding independen</option>
                  <option value="bukan_independen">Bukan independen</option>
                  <option value="bukan_sumber">Bukan sumber</option>
                </select>
                {f.sumber.length > 3 && (
                  <button type="button" className="iconbtn" aria-label={`Hapus sumber ${i + 1}`} onClick={() => set("sumber", f.sumber.filter((_, j) => j !== i))}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
            </div>
            <input className="input" aria-label={`Teks sumber ${i + 1}`} value={s.teks} onChange={(e) => set("sumber", f.sumber.map((x, j) => (j === i ? { ...x, teks: e.target.value } : x)))} />
            <input className="input" aria-label={`Alasan sumber ${i + 1}`} placeholder="Alasan singkat" value={s.alasan} onChange={(e) => set("sumber", f.sumber.map((x, j) => (j === i ? { ...x, alasan: e.target.value } : x)))} />
            <input className="input" type="url" aria-label={`Tautan sumber ${i + 1}`} placeholder="Tautan (opsional)" value={s.url ?? ""} onChange={(e) => set("sumber", f.sumber.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          </div>
        ))}
        {f.sumber.length < 6 && (
          <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => set("sumber", [...f.sumber, { teks: "", jenis: "bukan_sumber", alasan: "", url: "" }])}>
            <Plus aria-hidden /> Tambah sumber
          </button>
        )}
      </section>

      <section className="card stack">
        <h2>Tahap 3 · Teknik manipulasi</h2>
        <div className="chips" role="group" aria-label="Teknik yang dipakai">
          {konfig?.teknik.map((t) => (
            <button key={t.kode} type="button" className="chip" aria-pressed={f.teknik.includes(t.kode)} onClick={() => set("teknik", f.teknik.includes(t.kode) ? f.teknik.filter((x) => x !== t.kode) : [...f.teknik, t.kode])}>
              {t.nama}
            </button>
          ))}
        </div>
        <Field label="Pola berulang" htmlFor="k-pola" help="Tampil setelah peserta memeriksa tahap 3.">
          <textarea id="k-pola" className="textarea" style={{ minHeight: 76 }} value={f.pola} onChange={(e) => set("pola", e.target.value)} />
        </Field>
        <Field label="Pesan prebunking" htmlFor="k-pb" help="Tercetak di kartu PDF A5.">
          <textarea id="k-pb" className="textarea" style={{ minHeight: 76 }} value={f.pesan_prebunking} onChange={(e) => set("pesan_prebunking", e.target.value)} />
        </Field>
      </section>

      {riwayat.length > 0 && (
        <section className="stack-sm">
          <h2>Riwayat status</h2>
          <ol className="timeline">
            {riwayat.map((r, i) => (
              <li key={i}>
                <b style={{ color: "var(--ink)" }}>{STATUS_LABEL[r.ke]}</b> · {r.penelaah} · {tgl(r.waktu, true)}
                {r.catatan && <div className="muted">{r.catatan}</div>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <ErrorNote error={galat} />
      <button type="button" className="btn primary block" onClick={simpan}>
        {baru ? "Simpan kasus" : "Simpan perubahan"}
      </button>
    </div>
  );
}
