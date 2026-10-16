import { useEffect, useRef, useState } from "react";
import { useApp } from "../lib/app";
import { kirim } from "../lib/offline";
import type { Keputusan } from "../lib/types";
import { Note } from "./ui";

type Draf = Partial<Keputusan>;

/** Tombol JEDA (PRD Bab 8): tiga pertanyaan, satu skala niat, tepat satu tindakan. Tidak ada pilihan bawaan. */
export function TombolJeda({ sesiId, awal, tombol, onSelesai }: { sesiId: string; awal?: Keputusan | null; tombol: string; onSelesai: (k: Keputusan) => void }) {
  const { konfig } = useApp();
  const [d, setD] = useState<Draf>(awal ?? {});
  const [cek, setCek] = useState(false);
  const dicatat = useRef(false);

  useEffect(() => {
    if (dicatat.current) return;
    dicatat.current = true;
    void kirim("POST", `/api/sesi/${sesiId}/jeda/buka`).catch(() => undefined);
  }, [sesiId]);

  if (!konfig) return null;
  const j = konfig.jeda;
  const kurang = {
    q_bukti: !d.q_bukti,
    q_untung: !d.q_untung,
    q_akibat: !d.q_akibat,
    niat: !d.niat,
    tindakan: !d.tindakan,
  };
  const lengkap = !Object.values(kurang).some(Boolean);

  function simpan() {
    setCek(true);
    if (!lengkap) {
      const pertama = Object.entries(kurang).find(([, v]) => v)?.[0];
      document.getElementById(`jeda-${pertama}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      (document.querySelector(`#jeda-${pertama} input`) as HTMLInputElement | null)?.focus({ preventScroll: true });
      return;
    }
    onSelesai(d as Keputusan);
  }

  const grup = ({ id, judul, opsi, nilai }: { id: "q_bukti" | "q_untung" | "q_akibat" | "tindakan"; judul: string; opsi: { kode: string; label: string; keterangan?: string }[]; nilai?: string }) => (
    <fieldset id={`jeda-${id}`} aria-describedby={cek && kurang[id] ? `jeda-${id}-err` : undefined}>
      <legend>
        {judul}
        {id === "tindakan" && <span className="opt">Pilih satu</span>}
      </legend>
      <div className="stack-sm">
        {opsi.map((o) => (
          <label key={o.kode} className="choice compact">
            <input type="radio" name={`${sesiId}-${id}`} checked={nilai === o.kode} onChange={() => setD((x) => ({ ...x, [id]: o.kode }))} />
            <span>
              <span className="t">{o.label}</span>
              {o.keterangan && <span className="d">{o.keterangan}</span>}
            </span>
          </label>
        ))}
      </div>
      {cek && kurang[id] && (
        <p className="field" id={`jeda-${id}-err`} style={{ marginTop: 8 }}>
          <span className="err">{id === "tindakan" ? "Pilih satu tindakan." : "Pilih satu jawaban."}</span>
        </p>
      )}
    </fieldset>
  );

  return (
    <div className="stack-lg">
      <div className="jeda-hero">
        <div className="jeda-orb" role="img" aria-label="Ikon jeda" />
        <h2 style={{ marginTop: 14, fontSize: 24 }}>Tombol JEDA</h2>
        <p className="muted" style={{ maxWidth: "36ch" }}>
          Muncul sebelum kamu menyalin atau mengirim. Jawab tiga pertanyaan singkat.
        </p>
      </div>
      {grup({ id: "q_bukti", judul: "1. Apa buktinya?", opsi: j.q_bukti, nilai: d.q_bukti })}
      {grup({ id: "q_untung", judul: "2. Siapa yang diuntungkan?", opsi: j.q_untung, nilai: d.q_untung })}
      {grup({ id: "q_akibat", judul: "3. Apa akibatnya jika informasi ini salah?", opsi: j.q_akibat, nilai: d.q_akibat })}
      <fieldset id="jeda-niat">
        <legend>Seberapa ingin kamu meneruskannya apa adanya sekarang?</legend>
        <div className="scale">
          {j.niat.map((n) => (
            <label key={n.nilai}>
              <input type="radio" name={`${sesiId}-niat`} checked={d.niat === n.nilai} onChange={() => setD((x) => ({ ...x, niat: n.nilai }))} />
              <b>{n.nilai}</b>
              {n.label}
            </label>
          ))}
        </div>
        {cek && kurang.niat && (
          <p className="field" style={{ marginTop: 8 }}>
            <span className="err">Pilih satu angka.</span>
          </p>
        )}
      </fieldset>
      {grup({ id: "tindakan", judul: "Lalu, apa keputusanmu?", opsi: j.tindakan, nilai: d.tindakan })}
      <Note>JEDA tidak memberi vonis benar atau salah. Keputusanmu tersimpan di jejak verifikasimu.</Note>
      {cek && !lengkap && (
        <Note tone="warn">
          Masih ada {Object.values(kurang).filter(Boolean).length} pertanyaan yang belum dijawab. Jawab semuanya untuk lanjut.
        </Note>
      )}
      <button type="button" className="btn primary block" onClick={simpan}>
        {tombol}
      </button>
    </div>
  );
}
