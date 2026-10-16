"""Agregasi dasbor (M7). Semua angka agregat; kelompok di bawah K_MIN orang ditutup (FR-7.2)."""

from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import K_MIN
from .models import HasilAsesmen, JejakVerifikasi, Keanggotaan, Pengguna, RekapLuring, RuangJeda, SesiLatihan, SurveiSUS, UsulanKartu


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def peserta_layak(db: Session, ruang_ids: list[str]) -> set[str]:
    """Peserta yang masuk analisis: sudah setuju, dan bila di bawah 18 tahun sudah ada persetujuan wali (FR-1.3)."""
    if not ruang_ids:
        return set()
    rows = db.execute(
        select(Keanggotaan.pengguna_id, Keanggotaan.di_bawah_18, Keanggotaan.wali_disetujui)
        .join(Pengguna, Pengguna.id == Keanggotaan.pengguna_id)
        .where(Keanggotaan.ruang_id.in_(ruang_ids), Keanggotaan.persetujuan_data.is_(True), Pengguna.peran == "peserta")
    ).all()
    return {pid for pid, bawah18, wali in rows if (not bawah18) or wali}


def _tutup(n: int) -> bool:
    return n < K_MIN


def _metrik(nilai, n: int, target: str, **extra) -> dict:
    if _tutup(n):
        return {"nilai": None, "n": None, "tertutup": True, "target": target, **{k: None for k in extra}}
    return {"nilai": nilai, "n": n, "tertutup": False, "target": target, **extra}


def ringkasan(db: Session, ruang_ids: list[str]) -> dict:
    layak = peserta_layak(db, ruang_ids)

    sesi = db.scalars(select(SesiLatihan).where(SesiLatihan.ruang_id.in_(ruang_ids), SesiLatihan.pengguna_id.in_(layak))).all() if layak else []
    hasil = db.scalars(select(HasilAsesmen).where(HasilAsesmen.ruang_id.in_(ruang_ids), HasilAsesmen.pengguna_id.in_(layak))).all() if layak else []
    jejak_lengkap = (
        set(db.scalars(select(JejakVerifikasi.pengguna_id).where(JejakVerifikasi.ruang_id.in_(ruang_ids), JejakVerifikasi.kelengkapan == 4, JejakVerifikasi.pengguna_id.in_(layak))).all())
        if layak
        else set()
    )

    aktif = {s.pengguna_id for s in sesi} | {h.pengguna_id for h in hasil}
    n_aktif = len(aktif)

    # K1 dan K2: peserta yang punya tes awal dan akhir.
    per = defaultdict(dict)
    for h in hasil:
        per[h.pengguna_id][h.tipe] = h
    pasangan = [(v["awal"], v["akhir"]) for v in per.values() if "awal" in v and "akhir" in v]
    n_pas = len(pasangan)
    k1 = k2 = None
    awal_ak = akhir_ak = awal_ni = akhir_ni = None
    if n_pas:
        awal_ak = statistics.mean(a.skor_akurasi for a, _ in pasangan)
        akhir_ak = statistics.mean(b.skor_akurasi for _, b in pasangan)
        awal_ni = statistics.mean(a.skor_niat_berbagi for a, _ in pasangan)
        akhir_ni = statistics.mean(b.skor_niat_berbagi for _, b in pasangan)
        k1 = round((akhir_ak - awal_ak) / awal_ak * 100, 1) if awal_ak else None
        k2 = round((akhir_ni - awal_ni) / awal_ni * 100, 1) if awal_ni else None

    k3 = round(100 * len(jejak_lengkap & aktif) / n_aktif, 1) if n_aktif else None

    latihan = [s for s in sesi if s.mode == "latihan"]
    selesai = [s for s in latihan if s.selesai]
    p1 = round(100 * len(selesai) / len(latihan), 1) if latihan else None
    durasi = [(_aware(s.selesai) - _aware(s.mulai)).total_seconds() / 60 for s in selesai]
    p2 = round(statistics.median(durasi), 1) if durasi else None

    sus = db.scalars(select(SurveiSUS.skor).where(SurveiSUS.ruang_id.in_(ruang_ids), SurveiSUS.pengguna_id.in_(layak))).all() if layak else []
    p3 = round(statistics.mean(sus), 1) if sus else None

    n_terbit = len(db.scalars(select(UsulanKartu.id).where(UsulanKartu.ruang_id.in_(ruang_ids), UsulanKartu.status == "terbit")).all())
    p4 = round(n_terbit / n_aktif * 5, 2) if n_aktif else None  # kartu per 5 peserta

    cek = [s for s in sesi if s.mode == "cek"]
    if cek and n_aktif:
        t0 = min(_aware(s.mulai) for s in sesi)
        minggu = max(1, ((datetime.now(timezone.utc) - t0).days // 7) + 1)
        p5 = round(len(cek) / n_aktif / minggu, 2)
    else:
        p5 = None

    luring = db.scalars(select(RekapLuring).where(RekapLuring.ruang_id.in_(ruang_ids))).all()
    n_luring = sum(r.jumlah_peserta for r in luring)

    return {
        "peserta_terdaftar": _metrik(len(layak), len(layak), ""),
        "peserta_aktif": _metrik(n_aktif, n_aktif, ""),
        "k1": _metrik(k1, n_pas, "+20%", awal=awal_ak and round(awal_ak, 1), akhir=akhir_ak and round(akhir_ak, 1)),
        "k2": _metrik(k2, n_pas, "-15%", awal=awal_ni and round(awal_ni, 2), akhir=akhir_ni and round(akhir_ni, 2)),
        "k3": _metrik(k3, n_aktif, "80%", lengkap=len(jejak_lengkap & aktif)),
        "p1": _metrik(p1, n_aktif, "70%"),
        "p2": _metrik(p2, n_aktif, "≤10 menit"),
        "p3": _metrik(p3, len(sus), "68"),
        "p4": _metrik(p4, n_aktif, "1 per 5 peserta", terbit=n_terbit),
        "p5": _metrik(p5, n_aktif, "dilaporkan"),
        "luring": _metrik(
            {"peserta": n_luring, "latihan_selesai": sum(r.latihan_selesai for r in luring), "jejak_lengkap": sum(r.jejak_lengkap for r in luring), "sesi": len(luring)},
            n_luring,
            "",
        ),
        "k_min": K_MIN,
    }


def mingguan(db: Session, ruang: RuangJeda) -> list[dict]:
    """Baris CSV per minggu per ruang (FR-7.3). Minggu dengan peserta aktif < K_MIN ditutup."""
    layak = peserta_layak(db, [ruang.id])
    if not layak:
        return []
    sesi = db.scalars(select(SesiLatihan).where(SesiLatihan.ruang_id == ruang.id, SesiLatihan.pengguna_id.in_(layak))).all()
    jejak = db.scalars(select(JejakVerifikasi).where(JejakVerifikasi.ruang_id == ruang.id, JejakVerifikasi.pengguna_id.in_(layak))).all()
    buckets: dict[str, dict] = defaultdict(lambda: {"aktif": set(), "mulai": 0, "selesai": 0, "cek": 0, "jejak_lengkap": 0})
    for s in sesi:
        d = _aware(s.mulai)
        wk = (d - timedelta(days=d.weekday())).date().isoformat()
        b = buckets[wk]
        b["aktif"].add(s.pengguna_id)
        if s.mode == "cek":
            b["cek"] += 1
        else:
            b["mulai"] += 1
            b["selesai"] += 1 if s.selesai else 0
    for j in jejak:
        d = _aware(j.dibuat_pada)
        wk = (d - timedelta(days=d.weekday())).date().isoformat()
        if j.kelengkapan == 4:
            buckets[wk]["jejak_lengkap"] += 1
    rows = []
    for wk in sorted(buckets):
        b = buckets[wk]
        n = len(b["aktif"])
        tutup = _tutup(n)
        rows.append(
            {
                "minggu_mulai": wk,
                "ruang_kode": ruang.kode,
                "ruang_nama": ruang.nama,
                "peserta_aktif": f"<{K_MIN}" if tutup else n,
                "latihan_dimulai": "" if tutup else b["mulai"],
                "latihan_selesai": "" if tutup else b["selesai"],
                "cek_jeda": "" if tutup else b["cek"],
                "jejak_lengkap": "" if tutup else b["jejak_lengkap"],
            }
        )
    return rows
