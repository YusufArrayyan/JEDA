"""API staf: M1 kelola ruang, M7 dasbor & laporan, M8 rekap luring, M9 admin & moderasi."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .agregat import mingguan, peserta_layak, ringkasan
from .bootstrap import jalankan_retensi, kode_ruang_baru
from .config import K_MIN, MODE_UJI
from .db import get_db
from .models import (
    HasilAsesmen,
    JejakVerifikasi,
    KeputusanBerbagi,
    Kasus,
    Keanggotaan,
    LaporanKonten,
    LogAudit,
    Pengguna,
    RekapLuring,
    RuangJeda,
    SesiLatihan,
    SesiMasuk,
    SurveiSUS,
    Tema,
    Teknik,
    Telaah,
    UsulanKartu,
)
from .security import ApiError, audit, hash_rahasia, perlu_peran

router = APIRouter(prefix="/api")
staf = perlu_peran("fasilitator", "admin")
hanya_admin = perlu_peran("admin")


def _iso(dt):
    return dt.isoformat() if dt else None


def _ruang_dikelola(db: Session, user: Pengguna) -> list[RuangJeda]:
    q = select(RuangJeda).order_by(RuangJeda.nama)
    if user.peran != "admin":
        q = q.where(RuangJeda.fasilitator_id == user.id)
    return list(db.scalars(q))


def _ruang_milik(db: Session, user: Pengguna, ruang_id: str) -> RuangJeda:
    r = db.get(RuangJeda, ruang_id)
    if not r or (user.peran != "admin" and r.fasilitator_id != user.id):
        raise ApiError(404, "ruang_tidak_ada", "Ruang tidak ditemukan.", "Pilih ruang dari daftar ruangmu.")
    return r


def _ruang_dict(db: Session, r: RuangJeda) -> dict:
    anggota = db.scalars(select(Keanggotaan).join(Pengguna, Pengguna.id == Keanggotaan.pengguna_id).where(Keanggotaan.ruang_id == r.id, Pengguna.peran == "peserta")).all()
    f = db.get(Pengguna, r.fasilitator_id) if r.fasilitator_id else None
    return {
        "id": r.id,
        "nama": r.nama,
        "kode": r.kode,
        "wilayah": r.wilayah,
        "jenis_lembaga": r.jenis_lembaga,
        "aktif": r.aktif,
        "pembanding": r.pembanding,
        "tes_awal_buka": r.tes_awal_buka,
        "tes_akhir_buka": r.tes_akhir_buka,
        "fasilitator": {"id": f.id, "nama": f.nama_samaran} if f else None,
        "jumlah_peserta": len(anggota),
        "menunggu_wali": sum(1 for k in anggota if k.di_bawah_18 and not k.wali_disetujui and k.persetujuan_data),
    }


# ---------------------------------------------------------------- ruang (FR-1.4, FR-6.3, FR-6.4)


@router.get("/ruang")
def daftar_ruang(user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    return [_ruang_dict(db, r) for r in _ruang_dikelola(db, user)]


class RuangBaru(BaseModel):
    nama: str = Field(min_length=3, max_length=80)
    wilayah: str = Field(default="Kota Bengkulu", max_length=80)
    jenis_lembaga: Literal["sekolah", "kampus", "perpustakaan", "taman_baca", "lainnya"] = "sekolah"
    pembanding: bool = False
    fasilitator_id: str | None = None


@router.post("/ruang")
def buat_ruang(body: RuangBaru, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    fid = user.id
    if user.peran == "admin" and body.fasilitator_id:
        f = db.get(Pengguna, body.fasilitator_id)
        if not f or f.peran != "fasilitator":
            raise ApiError(422, "bukan_fasilitator", "Pengguna yang dipilih bukan fasilitator.", "Pilih akun berperan fasilitator.")
        fid = f.id
    kode = kode_ruang_baru()
    while db.scalar(select(RuangJeda.id).where(RuangJeda.kode == kode)):
        kode = kode_ruang_baru()
    r = RuangJeda(nama=body.nama.strip(), kode=kode, wilayah=body.wilayah.strip(), jenis_lembaga=body.jenis_lembaga, pembanding=body.pembanding, fasilitator_id=fid if user.peran == "fasilitator" or body.fasilitator_id else None)
    db.add(r)
    db.flush()
    if r.fasilitator_id:
        db.add(Keanggotaan(pengguna_id=r.fasilitator_id, ruang_id=r.id, peran_ruang="fasilitator", persetujuan_data=True, persetujuan_pada=datetime.now(timezone.utc)))
    audit(db, user, "ruang_dibuat", f"ruang:{r.kode}", {"pembanding": r.pembanding})
    db.commit()
    return _ruang_dict(db, r)


class RuangUbah(BaseModel):
    aktif: bool | None = None
    tes_awal_buka: bool | None = None
    tes_akhir_buka: bool | None = None
    pembanding: bool | None = None
    nama: str | None = Field(default=None, min_length=3, max_length=80)


@router.patch("/ruang/{ruang_id}")
def ubah_ruang(ruang_id: str, body: RuangUbah, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    r = _ruang_milik(db, user, ruang_id)
    perubahan = body.model_dump(exclude_none=True)
    for k, v in perubahan.items():
        setattr(r, k, v)
    audit(db, user, "ruang_diubah", f"ruang:{r.kode}", perubahan)
    db.commit()
    return _ruang_dict(db, r)


@router.post("/ruang/{ruang_id}/kode-baru")
def kode_ulang(ruang_id: str, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    """FR-1.4: buat ulang kode. Kode lama langsung tidak berlaku; anggota lama tetap di ruang."""
    r = _ruang_milik(db, user, ruang_id)
    lama = r.kode
    r.kode = kode_ruang_baru()
    audit(db, user, "kode_ruang_dibuat_ulang", f"ruang:{lama}")
    db.commit()
    return _ruang_dict(db, r)


@router.get("/ruang/{ruang_id}/persetujuan")
def status_persetujuan(ruang_id: str, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    """FR-1.3: fasilitator melihat status persetujuan (bukan jawaban atau jejak peserta)."""
    r = _ruang_milik(db, user, ruang_id)
    rows = db.execute(
        select(Keanggotaan, Pengguna.nama_samaran).join(Pengguna, Pengguna.id == Keanggotaan.pengguna_id).where(Keanggotaan.ruang_id == r.id, Pengguna.peran == "peserta").order_by(Pengguna.nama_samaran)
    ).all()
    return [
        {"keanggotaan_id": k.id, "nama_samaran": nama, "persetujuan_data": k.persetujuan_data, "di_bawah_18": k.di_bawah_18, "wali_disetujui": k.wali_disetujui, "bergabung_pada": _iso(k.bergabung_pada)}
        for k, nama in rows
    ]


class WaliBody(BaseModel):
    disetujui: bool


@router.post("/ruang/{ruang_id}/wali/{keanggotaan_id}")
def catat_wali(ruang_id: str, keanggotaan_id: str, body: WaliBody, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    r = _ruang_milik(db, user, ruang_id)
    k = db.get(Keanggotaan, keanggotaan_id)
    if not k or k.ruang_id != r.id:
        raise ApiError(404, "anggota_tidak_ada", "Peserta tidak ditemukan di ruang ini.", "")
    k.wali_disetujui = body.disetujui
    k.wali_dicatat_pada = datetime.now(timezone.utc)
    audit(db, user, "persetujuan_wali_dicatat", f"keanggotaan:{k.id}", {"disetujui": body.disetujui})
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- dasbor (M7)


def _pilih_ruang(db: Session, user: Pengguna, ruang_id: str | None) -> list[RuangJeda]:
    if ruang_id:
        return [_ruang_milik(db, user, ruang_id)]
    return _ruang_dikelola(db, user)


@router.get("/dasbor")
def dasbor(ruang_id: str | None = None, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    rs = _pilih_ruang(db, user, ruang_id)
    # Ruang pembanding dipisah dari ruang perlakuan agar K1-K2 tidak tercampur.
    perlakuan = [r for r in rs if not r.pembanding]
    pembanding = [r for r in rs if r.pembanding]
    return {
        "mode_uji": MODE_UJI,
        "diambil_pada": datetime.now(timezone.utc).isoformat(),
        "k_min": K_MIN,
        "lingkup": [{"id": r.id, "nama": r.nama, "pembanding": r.pembanding} for r in rs],
        "perlakuan": ringkasan(db, [r.id for r in perlakuan]) if perlakuan else None,
        "pembanding": ringkasan(db, [r.id for r in pembanding]) if pembanding else None,
        "per_ruang": [{"ruang": {"id": r.id, "nama": r.nama, "pembanding": r.pembanding}, **ringkasan(db, [r.id])} for r in rs] if len(rs) > 1 else [],
    }


@router.get("/dasbor/csv")
def dasbor_csv(ruang_id: str | None = None, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    """FR-7.3: hanya agregat per minggu dan per ruang, tanpa nama pengguna."""
    rs = _pilih_ruang(db, user, ruang_id)
    buf = io.StringIO()
    kolom = ["minggu_mulai", "ruang_kode", "ruang_nama", "peserta_aktif", "latihan_dimulai", "latihan_selesai", "cek_jeda", "jejak_lengkap"]
    w = csv.DictWriter(buf, fieldnames=kolom)
    w.writeheader()
    for r in rs:
        for row in mingguan(db, r):
            w.writerow(row)
    audit(db, user, "ekspor_rekap_csv", ",".join(r.kode for r in rs))
    db.commit()
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="rekap-jeda-{date.today().isoformat()}.csv"'})


# ---------------------------------------------------------------- rekap luring (FR-8.5)


class RekapBody(BaseModel):
    tanggal: date
    jumlah_peserta: int = Field(ge=1, le=500)
    latihan_selesai: int = Field(ge=0, le=500)
    jejak_lengkap: int = Field(ge=0, le=500)
    kasus_dipakai: str = Field(default="", max_length=120)


@router.get("/ruang/{ruang_id}/luring")
def daftar_rekap(ruang_id: str, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    r = _ruang_milik(db, user, ruang_id)
    rows = db.scalars(select(RekapLuring).where(RekapLuring.ruang_id == r.id).order_by(RekapLuring.tanggal.desc())).all()
    return [{"id": x.id, "tanggal": x.tanggal.isoformat(), "jumlah_peserta": x.jumlah_peserta, "latihan_selesai": x.latihan_selesai, "jejak_lengkap": x.jejak_lengkap, "kasus_dipakai": x.kasus_dipakai} for x in rows]


@router.post("/ruang/{ruang_id}/luring")
def tambah_rekap(ruang_id: str, body: RekapBody, user: Pengguna = Depends(staf), db: Session = Depends(get_db)):
    r = _ruang_milik(db, user, ruang_id)
    if body.latihan_selesai > body.jumlah_peserta * 3 or body.jejak_lengkap > body.jumlah_peserta * 3:
        raise ApiError(422, "rekap_tidak_wajar", "Angka latihan atau jejak terlalu besar dibanding jumlah peserta.", "Periksa lagi rekapnya. Hitung per peserta, bukan per kartu.")
    db.add(RekapLuring(ruang_id=r.id, pembuat_id=user.id, **body.model_dump()))
    audit(db, user, "rekap_luring", f"ruang:{r.kode}")
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- admin (M9)


@router.get("/admin/pengguna")
def daftar_staf(_: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(Pengguna).where(Pengguna.peran != "peserta").order_by(Pengguna.peran, Pengguna.nama_samaran)).all()
    jumlah_peserta = len(db.scalars(select(Pengguna.id).where(Pengguna.peran == "peserta", Pengguna.dianonimkan.is_(False))).all())
    return {"staf": [{"id": u.id, "nama": u.nama_samaran, "surel": u.surel, "peran": u.peran, "aktif": u.aktif} for u in rows], "jumlah_peserta": jumlah_peserta}


class StafBaru(BaseModel):
    nama: str = Field(min_length=2, max_length=40)
    surel: str = Field(min_length=5, max_length=160)
    peran: Literal["fasilitator", "pemeriksa", "admin"]
    kata_sandi: str = Field(min_length=10, max_length=200)


@router.post("/admin/pengguna")
def buat_staf(body: StafBaru, user: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    surel = body.surel.strip().lower()
    if db.scalar(select(Pengguna.id).where(Pengguna.surel == surel)):
        raise ApiError(409, "surel_dipakai", "Surel ini sudah terdaftar.", "Pakai surel lain atau ubah peran akun yang ada.")
    u = Pengguna(nama_samaran=body.nama.strip(), surel=surel, peran=body.peran, kata_sandi_hash=hash_rahasia(body.kata_sandi))
    db.add(u)
    audit(db, user, "staf_dibuat", f"pengguna:{surel}", {"peran": body.peran})
    db.commit()
    return {"id": u.id}


class UbahPeran(BaseModel):
    peran: Literal["fasilitator", "pemeriksa", "admin"] | None = None
    aktif: bool | None = None
    kata_sandi: str | None = Field(default=None, min_length=10, max_length=200)


@router.patch("/admin/pengguna/{pid}")
def ubah_staf(pid: str, body: UbahPeran, user: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    u = db.get(Pengguna, pid)
    if not u or u.peran == "peserta":
        raise ApiError(404, "pengguna_tidak_ada", "Akun tim tidak ditemukan.", "")
    if u.id == user.id:
        raise ApiError(409, "akun_sendiri", "Kamu tidak bisa mengubah peran atau menonaktifkan akunmu sendiri.", "Minta admin lain melakukannya.")
    if body.peran and body.peran != u.peran:
        audit(db, user, "peran_diubah", f"pengguna:{u.surel}", {"dari": u.peran, "ke": body.peran})
        u.peran = body.peran
    if body.aktif is not None and body.aktif != u.aktif:
        audit(db, user, "akun_diaktifkan" if body.aktif else "akun_dinonaktifkan", f"pengguna:{u.surel}")
        u.aktif = body.aktif
    if body.kata_sandi:
        u.kata_sandi_hash = hash_rahasia(body.kata_sandi)
        db.execute(delete(SesiMasuk).where(SesiMasuk.pengguna_id == u.id))
        audit(db, user, "kata_sandi_diatur_ulang", f"pengguna:{u.surel}")
    db.commit()
    return {"ok": True}


@router.get("/admin/laporan-konten")
def daftar_laporan(_: Pengguna = Depends(perlu_peran("admin", "pemeriksa")), db: Session = Depends(get_db)):
    rows = db.execute(select(LaporanKonten, Kasus.judul, Kasus.status).join(Kasus, Kasus.id == LaporanKonten.kasus_id).order_by(LaporanKonten.dibuat_pada.desc())).all()
    return [
        {"id": lp.id, "kasus_id": lp.kasus_id, "kasus_judul": judul, "kasus_status": st, "alasan": lp.alasan, "keterangan": lp.keterangan, "status": lp.status, "catatan_moderator": lp.catatan_moderator, "dibuat_pada": _iso(lp.dibuat_pada), "ditindak_pada": _iso(lp.ditindak_pada)}
        for lp, judul, st in rows
    ]


class TindakLaporan(BaseModel):
    keputusan: Literal["tarik", "tolak", "tindak"]
    catatan: str = Field(min_length=3, max_length=400)


@router.post("/admin/laporan-konten/{lid}")
def tindak_laporan(lid: str, body: TindakLaporan, user: Pengguna = Depends(perlu_peran("admin", "pemeriksa")), db: Session = Depends(get_db)):
    """FR-9.2: peninjauan laporan, penarikan, dan penolakan dengan alasan."""
    lp = db.get(LaporanKonten, lid)
    if not lp:
        raise ApiError(404, "laporan_tidak_ada", "Laporan tidak ditemukan.", "")
    lp.status = "ditolak" if body.keputusan == "tolak" else "ditindak"
    lp.catatan_moderator = body.catatan.strip()
    lp.ditindak_pada = datetime.now(timezone.utc)
    if body.keputusan == "tarik":
        k = db.get(Kasus, lp.kasus_id)
        if k and k.status != "diarsipkan":
            db.add(Telaah(kasus_id=k.id, penelaah_id=user.id, penelaah_nama=user.nama_samaran, tahap="moderasi", dari_status=k.status, ke_status="diarsipkan", catatan=body.catatan.strip()))
            k.status = "diarsipkan"
            audit(db, user, "kasus_ditarik", f"kasus:{k.id}", {"laporan": lp.id})
    audit(db, user, "laporan_ditindak", f"laporan:{lp.id}", {"keputusan": body.keputusan})
    db.commit()
    return {"ok": True}


class TeknikBody(BaseModel):
    kode: str = Field(pattern=r"^[a-z_]{3,32}$")
    nama: str = Field(min_length=3, max_length=60)
    deskripsi: str = Field(default="", max_length=300)
    aktif: bool = True


@router.get("/admin/teknik")
def daftar_teknik(_: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    return {
        "teknik": [{"kode": t.kode, "nama": t.nama, "deskripsi": t.deskripsi, "aktif": t.aktif} for t in db.scalars(select(Teknik).order_by(Teknik.id))],
        "tema": [{"kode": t.kode, "nama": t.nama, "aktif": t.aktif} for t in db.scalars(select(Tema).order_by(Tema.id))],
    }


@router.put("/admin/teknik")
def simpan_teknik(body: TeknikBody, user: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    """FR-9.4: label berubah, kode tetap; kasus terbit tidak diubah tanpa pemeriksa fakta."""
    t = db.scalars(select(Teknik).where(Teknik.kode == body.kode)).first() or Teknik(kode=body.kode)
    t.nama, t.deskripsi, t.aktif = body.nama.strip(), body.deskripsi.strip(), body.aktif
    db.add(t)
    audit(db, user, "teknik_disimpan", f"teknik:{body.kode}", {"aktif": body.aktif})
    db.commit()
    return {"ok": True}


class TemaBody(BaseModel):
    kode: str = Field(pattern=r"^[a-z_]{3,32}$")
    nama: str = Field(min_length=3, max_length=60)
    aktif: bool = True


@router.put("/admin/tema")
def simpan_tema(body: TemaBody, user: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    t = db.scalars(select(Tema).where(Tema.kode == body.kode)).first() or Tema(kode=body.kode)
    t.nama, t.aktif = body.nama.strip(), body.aktif
    db.add(t)
    audit(db, user, "tema_disimpan", f"tema:{body.kode}", {"aktif": body.aktif})
    db.commit()
    return {"ok": True}


@router.get("/admin/audit")
def log_audit(aksi: str | None = None, batas: int = 200, _: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    q = select(LogAudit).order_by(LogAudit.id.desc()).limit(min(max(batas, 1), 1000))
    if aksi:
        q = q.where(LogAudit.aksi == aksi)
    return [{"id": a.id, "waktu": _iso(a.waktu), "aktor": a.aktor_nama, "aksi": a.aksi, "objek": a.objek, "detail": a.detail} for a in db.scalars(q)]


@router.get("/admin/ekspor")
def ekspor_anonim(user: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    """FR-9.5: tanpa nama samaran, surel, atau teks bebas. ID peserta diganti nomor urut."""
    ruang = list(db.scalars(select(RuangJeda)))
    layak = peserta_layak(db, [r.id for r in ruang])
    alias = {pid: f"P{i:04d}" for i, pid in enumerate(sorted(layak), 1)}
    kode = {r.id: r.kode for r in ruang}
    pembanding = {r.id: r.pembanding for r in ruang}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["tabel", "peserta", "ruang", "kelompok", "a", "b", "c", "d", "e", "waktu"])
    for h in db.scalars(select(HasilAsesmen).where(HasilAsesmen.pengguna_id.in_(layak))):
        w.writerow(["tes", alias[h.pengguna_id], kode.get(h.ruang_id), "pembanding" if pembanding.get(h.ruang_id) else "perlakuan", h.tipe, h.perangkat, h.skor_akurasi, h.skor_niat_berbagi, "", _iso(h.selesai_pada)])
    for s in db.scalars(select(SesiLatihan).where(SesiLatihan.pengguna_id.in_(layak))):
        dur = round((s.selesai - s.mulai).total_seconds() / 60, 2) if s.selesai else ""
        w.writerow(["sesi", alias[s.pengguna_id], kode.get(s.ruang_id), "", s.mode, s.kasus_id or "", s.tahap_terakhir, dur, "", _iso(s.mulai)])
    for kp, pid, rid in db.execute(select(KeputusanBerbagi, SesiLatihan.pengguna_id, SesiLatihan.ruang_id).join(SesiLatihan, SesiLatihan.id == KeputusanBerbagi.sesi_id).where(SesiLatihan.pengguna_id.in_(layak))):
        w.writerow(["keputusan", alias[pid], kode.get(rid), "", kp.tindakan, kp.q_bukti, kp.q_untung, kp.q_akibat, kp.niat_berbagi_skala, _iso(kp.dibuat_pada)])
    for j in db.scalars(select(JejakVerifikasi).where(JejakVerifikasi.pengguna_id.in_(layak))):
        w.writerow(["jejak", alias[j.pengguna_id], kode.get(j.ruang_id), "", j.mode, j.kelengkapan, "", "", "", _iso(j.dibuat_pada)])
    for s in db.scalars(select(SurveiSUS).where(SurveiSUS.pengguna_id.in_(layak))):
        w.writerow(["sus", alias[s.pengguna_id], kode.get(s.ruang_id), "", s.skor, "", "", "", "", _iso(s.dibuat_pada)])
    for u in db.scalars(select(UsulanKartu).where(UsulanKartu.status.in_(("terbit", "diajukan", "ditelaah", "ditolak")))):
        w.writerow(["usulan", "", kode.get(u.ruang_id), "", u.status, u.teknik_kode, u.tema_kode, "", "", _iso(u.dibuat_pada)])
    audit(db, user, "ekspor_anonim", "semua_ruang", {"peserta": len(layak)})
    db.commit()
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="ekspor-anonim-jeda-{date.today().isoformat()}.csv"'})


@router.post("/admin/retensi")
def retensi(user: Pengguna = Depends(hanya_admin), db: Session = Depends(get_db)):
    audit(db, user, "retensi_diminta", "pengguna")
    db.commit()
    return jalankan_retensi()
