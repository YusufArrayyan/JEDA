import { AlertCircle, ArrowLeft, Check, CheckCircle2, FileText, Image as ImageIcon, Info, Mail, MessageCircle, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "../logo.png";
import { pesanGalat } from "../lib/api";

export function Logo({ size = 32, teks = true }: { size?: number; teks?: boolean }) {
  return (
    <span className="brand">
      <img src={logo} width={size} height={size} alt="" style={{ width: size, height: size }} />
      {teks && <b translate="no">JEDA</b>}
    </span>
  );
}

/** Judul layar menerima fokus saat pindah halaman (PRD 10.3). */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    document.title = `${typeof children === "string" ? children : "JEDA"} · JEDA`;
  }, [pathname, children]);
  return (
    <div className="page-head">
      <h1 ref={ref} tabIndex={-1}>
        {children}
      </h1>
      {sub && <p className="lead">{sub}</p>}
    </div>
  );
}

export function Back({ to, label = "Kembali", onClick }: { to?: string; label?: string; onClick?: () => void }) {
  const nav = useNavigate();
  return (
    <button type="button" className="backlink" onClick={onClick ?? (() => (to ? nav(to) : nav(-1)))}>
      <ArrowLeft aria-hidden /> {label}
    </button>
  );
}

export function Note({ tone = "", icon, children }: { tone?: "" | "ok" | "warn" | "err" | "brand"; icon?: ReactNode; children: ReactNode }) {
  const ic = icon ?? (tone === "ok" ? <CheckCircle2 aria-hidden /> : tone === "warn" ? <TriangleAlert aria-hidden /> : tone === "err" ? <AlertCircle aria-hidden /> : <Info aria-hidden />);
  return (
    <div className={`note ${tone}`} role={tone === "err" ? "alert" : undefined}>
      {ic}
      <div>{children}</div>
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const { message, hint } = pesanGalat(error);
  return (
    <Note tone="err">
      <b>{message}</b> {hint}
    </Note>
  );
}

export function StageBar({ tahap, label }: { tahap: number; label: string }) {
  return (
    <div>
      <div className="stagebar" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={Math.min(tahap, 4)} aria-label={`Tahap ${Math.min(tahap, 4)} dari 4`}>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={i < tahap ? "done" : i === tahap ? "now" : ""} />
        ))}
      </div>
      <p className="stage-label">
        Tahap {Math.min(tahap, 4)} dari 4 · {label}
      </p>
    </div>
  );
}

const FORMAT_IKON = { pesan: MessageCircle, unggahan: ImageIcon, surat: FileText, gambar: ImageIcon } as const;
const FORMAT_LABEL = { pesan: "Pesan berantai", unggahan: "Unggahan media sosial", surat: "Gambar surat", gambar: "Gambar atau video" } as const;

/** Bingkai konten uji dengan tanda SIMULASI (PRD 10.3). */
export function Simulasi({ format = "pesan", children }: { format?: keyof typeof FORMAT_IKON; children: ReactNode }) {
  const Ic = FORMAT_IKON[format] ?? Mail;
  return (
    <figure className="sim" style={{ margin: 0 }}>
      <div className="meta">
        <Ic aria-hidden /> {FORMAT_LABEL[format] ?? "Konten"}
        <span className="tag" aria-label="Materi simulasi">
          SIMULASI
        </span>
      </div>
      <blockquote style={{ margin: 0 }}>{children}</blockquote>
    </figure>
  );
}

export function Empty({ icon, judul, children, aksi }: { icon: ReactNode; judul: string; children?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <h3>{judul}</h3>
      {children && <p className="muted small">{children}</p>}
      {aksi}
    </div>
  );
}

export function Dots({ n }: { n: number }) {
  return (
    <span className="dots" aria-label={`Kelengkapan ${n} dari 4`}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}

export function UnsurChips({ kurang }: { kurang: string[] }) {
  const semua = ["sumber_primer", "pembanding", "tanggal_periksa", "konteks"] as const;
  const label = { sumber_primer: "Sumber primer", pembanding: "Pembanding independen", tanggal_periksa: "Tanggal pemeriksaan", konteks: "Konteks klaim" };
  return (
    <ul className="chips" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Unsur jejak">
      {semua.map((u) => {
        const ada = !kurang.includes(u);
        return (
          <li key={u} className={`badge ${ada ? "ok" : "warn"}`}>
            {ada ? <Check aria-hidden /> : <TriangleAlert aria-hidden />}
            {label[u]}
            <span className="sr-only">{ada ? "terisi" : "belum terisi"}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Dialog konfirmasi berbasis <dialog> agar fokus terkunci dan Esc menutup. */
export function Confirm({ open, judul, children, ya, tidak = "Batal", bahaya, onYa, onTidak }: { open: boolean; judul: string; children?: ReactNode; ya: string; tidak?: string; bahaya?: boolean; onYa: () => void; onTidak: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dlg" aria-labelledby={id} onClose={onTidak} onCancel={onTidak}>
      <div className="body">
        <h2 id={id}>{judul}</h2>
        {children && <div className="muted">{children}</div>}
      </div>
      <div className="actions">
        <button type="button" className="btn secondary sm" onClick={onTidak}>
          {tidak}
        </button>
        <button type="button" className={`btn sm ${bahaya ? "danger" : "primary"}`} onClick={onYa}>
          {ya}
        </button>
      </div>
    </dialog>
  );
}

export function Field({ label, help, error, children, htmlFor }: { label: string; help?: ReactNode; error?: string | null; children: ReactNode; htmlFor: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {help && (
        <span className="help" id={`${htmlFor}-help`}>
          {help}
        </span>
      )}
      {children}
      {error && (
        <span className="err" id={`${htmlFor}-err`} aria-live="polite">
          <AlertCircle size={16} aria-hidden style={{ marginTop: 2, flex: "none" }} /> {error}
        </span>
      )}
    </div>
  );
}

/** Peringatkan sebelum meninggalkan isian yang belum disimpan (tutup tab maupun pindah halaman).
 * Panggil `lepas()` tepat sebelum navigasi setelah isian tersimpan. */
export function useJagaIsian(kotor: boolean) {
  const aktif = useRef(kotor);
  aktif.current = kotor;
  useEffect(() => {
    if (!kotor) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [kotor]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => aktif.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Isianmu belum disimpan. Tinggalkan halaman ini?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  return () => {
    aktif.current = false;
  };
}
