import { CheckCircle2, ChevronRight, Download, FileStack, Flag, Gauge, LayoutGrid, Lightbulb, Play, Printer } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Confirm, Empty, ErrorNote, Field, Note, PageTitle, useJagaIsian } from "../components/ui";
import { api, ApiError, unduh } from "../lib/api";
import { namaTema, namaTeknik, STATUS_LABEL, STATUS_NADA, tgl, useApp } from "../lib/app";
import type { KasusRingkas, Usulan } from "../lib/types";

export default function Ruang() {
  const { tab = "bank" } = useParams();
  const { profil } = useApp();
  const staf = profil?.peran === "fasilitator" || profil?.peran === "admin";
  const tabs = [
    { id: "bank", label: "Bank kasus" },
    { id: "studio", label: "Studio kartu" },
    ...(staf ? [{ id: "tim", label: "Fasilitator" }] : []),
  ];
  return (
    <div className="stack-lg">
      <PageTitle sub={profil?.ruang ? `Kelompok belajarmu di ${profil.ruang.wilayah}.${profil.ruang.kode ? ` Kode ruang: ${profil.ruang.kode}` : ""}` : undefined}>{profil?.ruang?.nama ?? "Ruang JEDA"}</PageTitle>
      <nav className="segmented" aria-label="Bagian ruang">
        {tabs.map((t) => (
          <Link key={t.id} to={`/ruang/${t.id}`} aria-current={tab === t.id ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "bank" && <Bank />}
      {tab === "studio" && <Studio />}
      {tab === "tim" && staf && <PusatTim />}
    </div>
  );
}

// ---------------------------------------------------------------- bank kasus (FR-5.1)
function Bank() {
  const { konfig, toast, profil } = useApp();
  const [kasus, setKasus] = useState<KasusRingkas[] | null>(null);
  const [kartu, setKartu] = useState<Usulan[]>([]);
  const [teknik, setTeknik] = useState("");
  const [tema, setTema] = useState("");
  const [galat, setGalat] = useState<unknown>(null);
  const [lapor, setLapor] = useState<KasusRingkas | null>(null);
  const [alasan, setAlasan] = useState("kedaluwarsa");

  useEffect(() => {
    const q = new URLSearchParams();
    if (teknik) q.set("teknik", teknik);
    if (tema) q.set("tema", tema);
    Promise.all([api<KasusRingkas[]>(`/api/kasus?${q}`), api<Usulan[]>(`/api/kartu?${q}`)])
      .then(([k, c]) => {
        setKasus(k);
        setKartu(c);
      })
      .catch(setGalat);
  }, [teknik, tema]);

  async function kirimLapor() {
    if (!lapor) return;
    try {
      await api(`/api/kasus/${lapor.id}/lapor`, { method: "POST", body: { alasan } });
      toast("Laporan terkirim ke moderator.");
    } catch (e) {
      setGalat(e);
    }
    setLapor(null);
  }

  return (
    <div className="stack-lg">
      <div className="grid-2">
        <Field label="Teknik" htmlFor="f-teknik">
          <select id="f-teknik" className="select" value={teknik} onChange={(e) => setTeknik(e.target.value)}>
            <option value="">Semua teknik</option>
            {konfig?.teknik.map((t) => (
              <option key={t.kode} value={t.kode}>
                {t.nama}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tema" htmlFor="f-tema">
          <select id="f-tema" className="select" value={tema} onChange={(e) => setTema(e.target.value)}>
            <option value="">Semua tema</option>
            {konfig?.tema.map((t) => (
              <option key={t.kode} value={t.kode}>
                {t.nama}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorNote error={galat} />

      <section className="stack-sm" aria-labelledby="h-kasus">
        <div className="section-title">
          <h2 id="h-kasus">Kasus latihan</h2>
          <span className="caption">{kasus?.length ?? 0} kasus terbit</span>
        </div>
        {kasus?.length === 0 && <Empty icon={<FileStack aria-hidden />} judul="Tidak ada kasus untuk saringan ini">Ubah teknik atau tema di atas.</Empty>}
        <div className="grid-auto">
          {kasus?.map((k) => (
            <article key={k.id} className="card stack-sm">
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="badge">{namaTema(konfig, k.tema)}</span>
                {k.sudah_dilatih && (
                  <span className="badge ok">
                    <CheckCircle2 aria-hidden /> Sudah dilatih
                  </span>
                )}
              </div>
              <h3>{k.judul}</h3>
              <p className="small muted">{k.ringkasan}</p>
              <p className="caption">{k.teknik.map((t) => namaTeknik(konfig, t)).join(" · ")}</p>
              <p className="caption">Ditinjau ulang {tgl(k.tanggal_tinjau)}</p>
              <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
                {!profil?.latihan_terkunci && (
                  <Link to={`/latihan/${k.id}`} className="btn primary sm">
                    <Play aria-hidden /> Latih
                  </Link>
                )}
                <button type="button" className="btn secondary sm" onClick={() => unduh(`/api/kasus/${k.id}/pdf`, `kasus-jeda.pdf`).catch(setGalat)}>
                  <Download aria-hidden /> PDF A5
                </button>
                <button type="button" className="btn ghost sm" onClick={() => setLapor(k)} aria-label={`Laporkan kasus ${k.judul}`}>
                  <Flag aria-hidden /> Laporkan
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="stack-sm" aria-labelledby="h-kartu">
        <div className="section-title">
          <h2 id="h-kartu">Kartu prebunking</h2>
          <span className="caption">dari peserta, sudah ditelaah</span>
        </div>
        {kartu.length === 0 && <p className="muted small">Belum ada kartu untuk saringan ini.</p>}
        <div className="grid-auto">
          {kartu.map((c) => (
            <article key={c.id} className="card stack-sm" style={{ background: "var(--a)", border: 0 }}>
              <span className="badge" style={{ background: "#fff" }}>
                {namaTeknik(konfig, c.teknik)}
              </span>
              <h3>{c.judul}</h3>
              <p className="small">{c.pesan_prebunking}</p>
              <button type="button" className="btn secondary sm" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => unduh(`/api/kartu/${c.id}/pdf`, "kartu-jeda.pdf").catch(setGalat)}>
                <Printer aria-hidden /> Cetak A5
              </button>
            </article>
          ))}
        </div>
      </section>

      <Confirm open={!!lapor} judul="Laporkan kasus ini?" ya="Kirim laporan" onYa={kirimLapor} onTidak={() => setLapor(null)}>
        <div className="stack-sm" style={{ marginTop: 6 }}>
          <span>Moderator akan meninjau “{lapor?.judul}” paling lambat 2 hari kerja.</span>
          <label htmlFor="alasan-lapor" className="label" style={{ color: "var(--ink)", fontWeight: 600 }}>
            Alasan
          </label>
          <select id="alasan-lapor" className="select" value={alasan} onChange={(e) => setAlasan(e.target.value)}>
            <option value="kedaluwarsa">Informasinya sudah kedaluwarsa</option>
            <option value="keliru">Ada yang keliru</option>
            <option value="tidak_aman">Memuat orang nyata atau data pribadi</option>
            <option value="lainnya">Alasan lain</option>
          </select>
        </div>
      </Confirm>
    </div>
  );
}

// ---------------------------------------------------------------- studio kartu (FR-5.2, FR-5.3)
const KESELAMATAN = [
  { k: "tanpa_wajah", label: "Tanpa wajah atau suara orang nyata" },
  { k: "tidak_mempermalukan", label: "Tidak mempermalukan korban" },
  { k: "bertanda_simulasi", label: "Bertanda SIMULASI" },
  { k: "tanpa_data_pribadi", label: "Tidak memuat data pribadi (nama, nomor, alamat)" },
];
const KOSONG = { jenis: "kartu" as "kartu" | "kasus", judul: "", klaim: "", teknik: "", tema: "", bukti: "", pesan_prebunking: "" };

function Studio() {
  const { konfig, toast } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState(KOSONG);
  const [aman, setAman] = useState<Record<string, boolean>>({});
  const [galatBidang, setGalatBidang] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState<unknown>(null);
  const [milik, setMilik] = useState<Usulan[] | null>(null);
  const [kirimKe, setKirimKe] = useState(false);

  const muat = () => api<Usulan[]>("/api/usulan/saya").then(setMilik).catch(() => setMilik([]));
  useEffect(() => {
    void muat();
  }, []);

  useJagaIsian(Object.entries(f).some(([k, v]) => k !== "jenis" && String(v).trim() !== ""));
  const semuaAman = useMemo(() => KESELAMATAN.every((s) => aman[s.k]), [aman]);

  async function ajukan(draf: boolean) {
    setGalat(null);
    const g: Record<string, string> = {};
    if (!draf) {
      if (!f.judul.trim()) g.judul = "Isi judul kartu.";
      if (!f.klaim.trim()) g.klaim = "Tulis klaim yang beredar.";
      if (!f.teknik) g.teknik = "Pilih teknik manipulasi.";
      if (!f.tema) g.tema = "Pilih tema.";
      if (!f.bukti.trim()) g.bukti = "Tulis bukti dari sumber primer atau pembanding.";
      if (!f.pesan_prebunking.trim()) g.pesan = "Tulis pesan prebunking untuk temanmu.";
      if (!semuaAman) g.aman = "Centang keempat butir keselamatan sebelum mengajukan.";
    }
    setGalatBidang(g);
    if (Object.keys(g).length) {
      document.getElementById(`u-${Object.keys(g)[0]}`)?.focus();
      return;
    }
    setKirimKe(true);
    try {
      await api("/api/usulan", { method: "POST", body: { ...f, keselamatan: aman, draf } });
      setF(KOSONG);
      setAman({});
      toast(draf ? "Draf tersimpan." : "Usulan terkirim ke fasilitator.");
      void muat();
      nav("/ruang/studio");
    } catch (e) {
      if (e instanceof ApiError && e.code === "keselamatan_belum") setGalatBidang({ aman: e.message });
      else setGalat(e);
    } finally {
      setKirimKe(false);
    }
  }

  const up = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const aria = (k: string) => ({ "aria-invalid": !!galatBidang[k], "aria-describedby": galatBidang[k] ? `u-${k}-err` : undefined });

  return (
    <div className="stack-lg">
      <Note tone="brand" icon={<Lightbulb aria-hidden />}>
        Ubah hasil pemeriksaanmu menjadi kartu yang membantu teman mengenali tipuan sebelum bertemu kasusnya. Kartu ditelaah fasilitator, lalu pemeriksa fakta, sebelum terbit.
      </Note>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void ajukan(false); }} noValidate>
        <fieldset>
          <legend>Jenis usulan</legend>
          <div className="segmented" role="group" aria-label="Jenis usulan">
            {(["kartu", "kasus"] as const).map((j) => (
              <button key={j} type="button" aria-pressed={f.jenis === j} onClick={() => setF((x) => ({ ...x, jenis: j }))}>
                {j === "kartu" ? "Kartu prebunking" : "Kasus baru"}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Judul" htmlFor="u-judul" error={galatBidang.judul}>
          <input id="u-judul" className="input" maxLength={120} value={f.judul} onChange={up("judul")} {...aria("judul")} />
        </Field>
        <Field label="Klaim yang beredar" htmlFor="u-klaim" help="Tulis ulang intinya. Hapus nama orang, nomor, dan alamat." error={galatBidang.klaim}>
          <textarea id="u-klaim" className="textarea" style={{ minHeight: 96 }} maxLength={600} value={f.klaim} onChange={up("klaim")} {...aria("klaim")} />
        </Field>
        <div className="grid-2">
          <Field label="Teknik" htmlFor="u-teknik" error={galatBidang.teknik}>
            <select id="u-teknik" className="select" value={f.teknik} onChange={up("teknik")} {...aria("teknik")}>
              <option value="">Pilih teknik</option>
              {konfig?.teknik.map((t) => (
                <option key={t.kode} value={t.kode}>
                  {t.nama}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tema" htmlFor="u-tema" error={galatBidang.tema}>
            <select id="u-tema" className="select" value={f.tema} onChange={up("tema")} {...aria("tema")}>
              <option value="">Pilih tema</option>
              {konfig?.tema.map((t) => (
                <option key={t.kode} value={t.kode}>
                  {t.nama}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Bukti" htmlFor="u-bukti" help="Apa kata sumber primer atau pembanding independen?" error={galatBidang.bukti}>
          <textarea id="u-bukti" className="textarea" style={{ minHeight: 88 }} maxLength={600} value={f.bukti} onChange={up("bukti")} {...aria("bukti")} />
        </Field>
        <Field label="Pesan prebunking" htmlFor="u-pesan" help="Satu atau dua kalimat yang menenangkan, tanpa menyalahkan siapa pun." error={galatBidang.pesan}>
          <textarea id="u-pesan" className="textarea" style={{ minHeight: 88 }} maxLength={400} value={f.pesan_prebunking} onChange={up("pesan_prebunking")} {...aria("pesan")} />
        </Field>
        <fieldset id="u-aman" tabIndex={-1} aria-describedby={galatBidang.aman ? "u-aman-err" : undefined}>
          <legend>Daftar periksa keselamatan</legend>
          <div className="stack-sm">
            {KESELAMATAN.map((s) => (
              <label key={s.k} className="check">
                <input type="checkbox" checked={!!aman[s.k]} onChange={(e) => setAman((a) => ({ ...a, [s.k]: e.target.checked }))} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          {galatBidang.aman && (
            <p className="field" id="u-aman-err" style={{ marginTop: 8 }}>
              <span className="err">{galatBidang.aman}</span>
            </p>
          )}
        </fieldset>
        <ErrorNote error={galat} />
        <div className="row wrap">
          <button type="button" className="btn secondary" onClick={() => ajukan(true)} disabled={kirimKe}>
            Simpan draf
          </button>
          <button className="btn primary" style={{ flex: 1 }} disabled={kirimKe}>
            Ajukan ke fasilitator
          </button>
        </div>
      </form>

      <section className="stack-sm" aria-labelledby="h-usulanku">
        <h2 id="h-usulanku">Usulanku</h2>
        {milik?.length === 0 && <p className="muted small">Belum ada usulan. Kartu pertamamu bisa membantu satu kelas.</p>}
        <div className="stack-sm">
          {milik?.map((u) => (
            <details key={u.id} className="card tight">
              <summary className="row between" style={{ cursor: "pointer", minHeight: 32 }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{u.judul}</span>
                <span className={`badge ${STATUS_NADA[u.status]}`}>{STATUS_LABEL[u.status]}</span>
              </summary>
              <ol className="timeline" style={{ marginTop: 14 }}>
                {u.riwayat?.map((r, i) => (
                  <li key={i}>
                    <b style={{ color: "var(--ink)" }}>{STATUS_LABEL[r.ke]}</b> · {r.penelaah} · {tgl(r.waktu, true)}
                    {r.catatan && <div className="muted">{r.catatan}</div>}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- pusat fasilitator (M7, M8)
function PusatTim() {
  const [galat, setGalat] = useState<unknown>(null);
  const item = [
    { to: "/dasbor", ic: Gauge, judul: "Dasbor fasilitator", isi: "Kemajuan kelompok dalam angka gabungan." },
    { to: "/kelola-ruang", ic: LayoutGrid, judul: "Kelola ruang", isi: "Kode ruang, jendela tes, persetujuan wali, rekap luring." },
    { to: "/telaah", ic: CheckCircle2, judul: "Telaah usulan", isi: "Telaah tahap 1 untuk usulan kartu dari ruangmu." },
  ];
  return (
    <div className="stack">
      <div className="list">
        {item.map((i) => (
          <Link key={i.to} to={i.to} className="list-item">
            <i.ic aria-hidden style={{ color: "var(--brand)", width: 22, height: 22 }} />
            <div className="grow">
              <div className="title">{i.judul}</div>
              <span className="caption">{i.isi}</span>
            </div>
            <ChevronRight aria-hidden />
          </Link>
        ))}
      </div>
      <div className="card stack-sm">
        <h3>Kartu cetak untuk jalur luring</h3>
        <p className="small muted">Satu set berisi panduan empat tahap, tiga pertanyaan Tombol JEDA, lima tindakan, dan semua kasus terbit. Bisa dipakai tanpa gawai.</p>
        <button type="button" className="btn secondary" style={{ alignSelf: "flex-start" }} onClick={() => unduh("/api/luring/kartu-cetak.pdf", "set-kartu-luring-jeda.pdf").catch(setGalat)}>
          <Printer aria-hidden /> Unduh set kartu (PDF A5)
        </button>
        <ErrorNote error={galat} />
      </div>
    </div>
  );
}
