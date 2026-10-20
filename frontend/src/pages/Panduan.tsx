import { Download, ExternalLink, FileText } from "lucide-react";
import { Back, Logo, Note, PageTitle } from "../components/ui";
import { useApp } from "../lib/app";

/** Panduan penggunaan dan video demo. Terbuka tanpa masuk, agar calon peserta dan juri bisa melihatnya dulu. */
export default function Panduan() {
  const { profil, konfig } = useApp();
  return (
    <div className="panduan">
      <header className="row between">
        <Logo size={32} />
        <Back to={profil ? "/" : "/masuk"} label={profil ? "Beranda" : "Halaman masuk"} />
      </header>

      <PageTitle sub="Lihat alur lengkap JEDA dalam kurang dari empat menit, lalu simpan panduannya untuk dibaca ulang.">Panduan dan video demo</PageTitle>

      <section className="stack-sm" aria-labelledby="h-video">
        <h2 id="h-video">Video demo</h2>
        <video className="panduan-video" controls preload="metadata" playsInline poster="/media/demo-jeda-poster.jpg">
          <source src="/media/demo-jeda.mp4" type="video/mp4" />
          <track kind="captions" src="/media/demo-jeda.vtt" srcLang="id" label="Bahasa Indonesia" />
          Peramban ini tidak bisa memutar video. <a href="/media/demo-jeda.mp4">Unduh videonya</a>.
        </video>
        <p className="caption">3 menit 45 detik · bersuara · teks tersedia lewat tombol CC. Rekaman memakai data contoh.</p>
      </section>

      <section className="stack-sm" aria-labelledby="h-pdf">
        <h2 id="h-pdf">Panduan penggunaan</h2>
        <div className="card row" style={{ gap: 14 }}>
          <FileText size={28} aria-hidden style={{ color: "var(--brand)", flex: "none" }} />
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Panduan penggunaan JEDA</div>
            <span className="caption">PDF · 12 halaman · 7 MB · untuk peserta dan tim program</span>
          </div>
        </div>
        <div className="grid-2">
          <a className="btn primary" href="/media/panduan-jeda.pdf" download="Panduan-Penggunaan-JEDA.pdf">
            <Download aria-hidden /> Unduh PDF
          </a>
          <a className="btn secondary" href="/media/panduan-jeda.pdf" target="_blank" rel="noopener">
            <ExternalLink aria-hidden /> Buka PDF
          </a>
        </div>
      </section>

      {konfig?.mode_uji && (
        <section className="stack-sm" aria-labelledby="h-demo">
          <h2 id="h-demo">Coba dengan akun demo</h2>
          <div className="list">
            <div className="list-item">
              <div className="grow">
                <div className="title">Peserta baru</div>
                <span className="caption">Masuk dengan kode ruang, nama samaran bebas</span>
              </div>
              <code className="kode-demo">JD-07-BKL</code>
            </div>
            <div className="list-item">
              <div className="grow">
                <div className="title">Peserta demo (Rafi)</div>
                <span className="caption">Pakai kode pribadi</span>
              </div>
              <code className="kode-demo">RAFI-2026</code>
            </div>
          </div>
          <Note tone="warn">Ini lingkungan uji dengan data contoh, dan akun demo dipakai bersama. Jangan isi nama asli atau data pribadi.</Note>
        </section>
      )}
    </div>
  );
}
