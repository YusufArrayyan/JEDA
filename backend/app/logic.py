"""Aturan penilaian tahap, kelengkapan jejak, dan skor tes. Fungsi murni agar mudah diuji."""

from __future__ import annotations

from .content import JEDA_OPSI

TINDAKAN_SAH = {k for k, *_ in JEDA_OPSI["tindakan"]}
JAWABAN_JEDA_SAH = {q: {k for k, _ in JEDA_OPSI[q]} for q in ("q_bukti", "q_untung", "q_akibat")}
LABEL_TIDAK_TERVERIFIKASI = {"keliru", "menyesatkan", "sintetis"}


def skor_tahap(konten: dict, teknik_benar: list[str], tahap: int, jawaban: dict) -> float:
    """Skor 0..1 per tahap. Tahap 4 tidak dinilai benar/salah (tidak ada vonis)."""
    if tahap == 1:
        pilih = set(jawaban.get("pilihan", []))
        tepat = {p["id"] for p in konten.get("petunjuk", []) if p["tepat"]}
        return round(len(pilih & tepat) / max(len(tepat), 1), 3)
    if tahap == 2:
        jenis = {s["id"]: s["jenis"] for s in konten.get("sumber", [])}
        primer_ok = jenis.get(jawaban.get("primer")) == "primer"
        pemb = jawaban.get("pembanding", [])
        pemb_ok = any(jenis.get(x) == "independen" for x in pemb)
        return round((primer_ok + pemb_ok) / 2, 3)
    if tahap == 3:
        pilih = set(jawaban.get("teknik", []))
        benar = set(teknik_benar)
        if not benar:
            return 0.0
        # Jaccard: memberi nilai pada teknik tepat dan mengurangi pilihan yang bukan.
        return round(len(pilih & benar) / len(pilih | benar), 3)
    return 1.0


def susun_jejak_latihan(konten: dict, judul: str, jawaban2: dict, tanggal_periksa) -> dict:
    """FR-2.8: jejak tersusun otomatis dari jawaban tahap. Pembanding hanya dihitung bila independen."""
    sumber = {s["id"]: s for s in konten.get("sumber", [])}
    primer = sumber.get(jawaban2.get("primer") or "")
    pemb = [sumber[x] for x in jawaban2.get("pembanding", []) if x in sumber and sumber[x]["jenis"] == "independen"]
    return {
        "klaim": judul,
        "sumber_primer": primer["teks"] if primer and primer["jenis"] == "primer" else "",
        "sumber_primer_url": (primer or {}).get("url", "") if primer and primer["jenis"] == "primer" else "",
        "pembanding": "; ".join(p["teks"] for p in pemb),
        "pembanding_url": pemb[0].get("url", "") if pemb else "",
        "tanggal_periksa": tanggal_periksa,
        "konteks": konten.get("konteks", ""),
    }


def hitung_kelengkapan(sumber_primer: str, pembanding: str, tanggal_periksa, konteks: str) -> int:
    """FR-4.2: empat unsur. 4 dari 4 = jejak lengkap (K3)."""
    return sum(bool(x and str(x).strip()) for x in (sumber_primer, pembanding, tanggal_periksa, konteks))


def unsur_kurang(sumber_primer: str, pembanding: str, tanggal_periksa, konteks: str) -> list[str]:
    nama = []
    if not (sumber_primer or "").strip():
        nama.append("sumber_primer")
    if not (pembanding or "").strip():
        nama.append("pembanding")
    if not tanggal_periksa:
        nama.append("tanggal_periksa")
    if not (konteks or "").strip():
        nama.append("konteks")
    return nama


def skor_asesmen(butir: list[dict], jawaban: dict) -> tuple[float, float]:
    """FR-6.2: skor akurasi (persen label tepat) dan rata-rata niat berbagi (1..5) pada butir belum terverifikasi."""
    tepat = 0
    niat = []
    for b in butir:
        j = jawaban.get(b["id"]) or {}
        if j.get("label") == b["label"]:
            tepat += 1
        if b["label"] in LABEL_TIDAK_TERVERIFIKASI and isinstance(j.get("niat"), int):
            niat.append(j["niat"])
    akurasi = round(100 * tepat / max(len(butir), 1), 2)
    niat_rata = round(sum(niat) / len(niat), 3) if niat else 0.0
    return akurasi, niat_rata


def skor_sus(jawaban: list[int]) -> float:
    """Skor SUS standar 0..100 dari 10 butir skala 1..5."""
    total = 0
    for i, v in enumerate(jawaban):
        total += (v - 1) if i % 2 == 0 else (5 - v)
    return round(total * 2.5, 1)
