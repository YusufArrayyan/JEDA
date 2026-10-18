"""API peserta: M1 akun & ruang, M2 latihan, M3 cek, M4 jejak, M6 tes."""

from __future__ import annotations

import random
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import content
from .bootstrap import hapus_data_pengguna, kode_pribadi_baru
from .config import CEK_MAKS_KARAKTER, COOKIE_SECURE, MODE_UJI, SESSION_DAYS
from .db import get_db
from .logic import JAWABAN_JEDA_SAH, TINDAKAN_SAH, hitung_kelengkapan, skor_asesmen, skor_sus, skor_tahap, susun_jejak_latihan, unsur_kurang
from .models import (
    ButirAsesmen,
    HasilAsesmen,
    JawabanTahap,
    JejakVerifikasi,
    Kasus,
    Keanggotaan,
    KeputusanBerbagi,
    Notifikasi,
    Pengguna,
    RuangJeda,
    SesiLatihan,
    SurveiSUS,
    Tema,
    Teknik,
    UsulanKartu,
)
from .security import (
    COOKIE_NAME,
    ApiError,
    audit,
    buat_sesi,
    catat,
    cocok_rahasia,
    hash_rahasia,
    keanggotaan,
    masuk_limiter,
    pengguna_aktif,
    pengguna_opsional,
    ruang_utama,
)

router = APIRouter(prefix="/api")


def _iso(dt):
    return dt.isoformat() if dt else None


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _set_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", secure=COOKIE_SECURE, max_age=int(SESSION_DAYS * 86400), path="/")


# ---------------------------------------------------------------- konfigurasi publik


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/konfigurasi")
def konfigurasi(db: Session = Depends(get_db)):
    return {
        "mode_uji": MODE_UJI,
        "cek_maks": CEK_MAKS_KARAKTER,
        "teknik": [{"kode": t.kode, "nama": t.nama, "deskripsi": t.deskripsi} for t in db.scalars(select(Teknik).where(Teknik.aktif.is_(True)).order_by(Teknik.id))],
        "tema": [{"kode": t.kode, "nama": t.nama} for t in db.scalars(select(Tema).where(Tema.aktif.is_(True)).order_by(Tema.id))],
        "jeda": {
            "q_bukti": [{"kode": k, "label": v} for k, v in content.JEDA_OPSI["q_bukti"]],
            "q_untung": [{"kode": k, "label": v} for k, v in content.JEDA_OPSI["q_untung"]],
            "q_akibat": [{"kode": k, "label": v} for k, v in content.JEDA_OPSI["q_akibat"]],
            "tindakan": [{"kode": k, "label": v, "keterangan": d} for k, v, d in content.JEDA_OPSI["tindakan"]],
            "niat": [{"nilai": n, "label": label} for n, label in content.NIAT_SKALA],
        },
        "label_asesmen": [{"kode": k, "label": v, "keterangan": d} for k, v, d in content.LABEL_ASESMEN],
        "sus": content.SUS_BUTIR,
    }


# ---------------------------------------------------------------- M1 akun dan ruang


class MasukRuang(BaseModel):
    kode: str = Field(min_length=1, max_length=20)
    nama_samaran: str = Field(min_length=2, max_length=24)
    surel: str | None = Field(default=None, max_length=160)


class MasukKode(BaseModel):
    kode_pribadi: str = Field(min_length=4, max_length=12)


class MasukStaf(BaseModel):
    surel: str = Field(min_length=3, max_length=160)
    kata_sandi: str = Field(min_length=1, max_length=200)


def _profil(db: Session, u: Pengguna) -> dict:
    r = ruang_utama(db, u)
    k = keanggotaan(db, u, r.id if r else None)
    tes = {h.tipe: {"skor_akurasi": h.skor_akurasi, "skor_niat_berbagi": h.skor_niat_berbagi, "selesai_pada": _iso(h.selesai_pada)} for h in db.scalars(select(HasilAsesmen).where(HasilAsesmen.pengguna_id == u.id, HasilAsesmen.ruang_id == (r.id if r else "")))}
    latihan_terkunci = bool(r and r.pembanding and "akhir" not in tes and u.peran == "peserta")
    belum_dibaca = len(db.scalars(select(Notifikasi.id).where(Notifikasi.pengguna_id == u.id, Notifikasi.dibaca.is_(False))).all())
    return {
        "id": u.id,
        "nama_samaran": u.nama_samaran,
        "peran": u.peran,
        "surel": u.surel,
        "ruang": (
            {"id": r.id, "nama": r.nama, "kode": r.kode if u.peran != "peserta" else None, "wilayah": r.wilayah, "pembanding": r.pembanding, "tes_awal_buka": r.tes_awal_buka, "tes_akhir_buka": r.tes_akhir_buka}
            if r
            else None
        ),
        "persetujuan": bool(k and k.persetujuan_data) or u.peran != "peserta",
        "di_bawah_18": bool(k and k.di_bawah_18),
        "wali_disetujui": bool(k and k.wali_disetujui),
        "tes": tes,
        "latihan_terkunci": latihan_terkunci,
        "sus_selesai": bool(db.scalar(select(SurveiSUS.id).where(SurveiSUS.pengguna_id == u.id))),
        "notifikasi_baru": belum_dibaca,
    }


@router.post("/masuk/ruang")
def masuk_ruang(body: MasukRuang, request: Request, response: Response, db: Session = Depends(get_db)):
    """FR-1.1: kode tidak valid tidak membuka petunjuk apakah kode itu ada atau sekadar nonaktif."""
    masuk_limiter.check("ruang:" + (request.client.host if request.client else "?"))
    kode = body.kode.strip().upper()
    r = db.scalars(select(RuangJeda).where(RuangJeda.kode == kode, RuangJeda.aktif.is_(True))).first()
    if not r:
        raise ApiError(404, "kode_tidak_ditemukan", "Kode ruang tidak ditemukan.", "Periksa huruf dan angkanya, atau tanyakan ke fasilitatormu.")
    surel = (body.surel or "").strip().lower() or None
    if surel and db.scalar(select(Pengguna.id).where(Pengguna.surel == surel)):
        raise ApiError(409, "surel_dipakai", "Surel ini sudah dipakai akun lain.", "Kosongkan surel atau pakai surel lain. Surel tidak wajib.")
    kode_pribadi = kode_pribadi_baru()
    u = Pengguna(nama_samaran=body.nama_samaran.strip(), peran="peserta", surel=surel, kode_pribadi_hash=hash_rahasia(kode_pribadi), kode_pribadi_petunjuk=kode_pribadi[:4])
    db.add(u)
    db.flush()
    db.add(Keanggotaan(pengguna_id=u.id, ruang_id=r.id, urutan_perangkat=random.choice(["AB", "BA"])))
    audit(db, u, "daftar", f"ruang:{r.kode}")
    tok = buat_sesi(db, u)
    _set_cookie(response, tok.token)
    return {"kode_pribadi": kode_pribadi, "profil": _profil(db, u)}


@router.post("/masuk/kode")
def masuk_kode(body: MasukKode, request: Request, response: Response, db: Session = Depends(get_db)):
    masuk_limiter.check("kode:" + (request.client.host if request.client else "?"))
    kode = body.kode_pribadi.strip().upper()
    if "-" not in kode and len(kode) == 8:
        kode = f"{kode[:4]}-{kode[4:]}"
    cocok = None
    for u in db.scalars(select(Pengguna).where(Pengguna.kode_pribadi_petunjuk == kode[:4], Pengguna.aktif.is_(True))):
        if cocok_rahasia(kode, u.kode_pribadi_hash):
            cocok = u
            break
    if not cocok:
        raise ApiError(401, "kode_pribadi_salah", "Kode pribadi tidak cocok.", "Periksa lagi delapan huruf dan angkanya. Jika lupa, minta fasilitator membantumu bergabung ulang.")
    audit(db, cocok, "masuk", "kode_pribadi")
    tok = buat_sesi(db, cocok)
    _set_cookie(response, tok.token)
    return {"profil": _profil(db, cocok)}


@router.post("/masuk/staf")
def masuk_staf(body: MasukStaf, request: Request, response: Response, db: Session = Depends(get_db)):
    masuk_limiter.check("staf:" + (request.client.host if request.client else "?"))
    u = db.scalars(select(Pengguna).where(Pengguna.surel == body.surel.strip().lower(), Pengguna.aktif.is_(True))).first()
    if not u or u.peran == "peserta" or not cocok_rahasia(body.kata_sandi, u.kata_sandi_hash):
        raise ApiError(401, "masuk_gagal", "Surel atau kata sandi tidak cocok.", "Periksa lagi isiannya. Peserta masuk dengan kode ruang, bukan dari sini.")
    audit(db, u, "masuk", "staf")
    tok = buat_sesi(db, u)
    _set_cookie(response, tok.token)
    return {"profil": _profil(db, u)}


@router.post("/keluar")
def keluar(request: Request, response: Response, db: Session = Depends(get_db)):
    from .models import SesiMasuk

    tok = request.cookies.get(COOKIE_NAME)
    if tok and (s := db.get(SesiMasuk, tok)):
        db.delete(s)
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/saya")
def saya(user: Pengguna | None = Depends(pengguna_opsional), db: Session = Depends(get_db)):
    return {"profil": _profil(db, user) if user else None}


class GantiSandi(BaseModel):
    lama: str = Field(min_length=1, max_length=200)
    baru: str = Field(min_length=10, max_length=200)


@router.post("/saya/kata-sandi")
def ganti_kata_sandi(body: GantiSandi, request: Request, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """Akun tim mengganti kata sandinya sendiri. Sesi lain milik akun ini diakhiri."""
    from .models import SesiMasuk

    masuk_limiter.check("sandi:" + user.id)
    if user.peran == "peserta":
        raise ApiError(403, "akses_ditolak", "Peserta masuk dengan kode pribadi, bukan kata sandi.", "")
    if not cocok_rahasia(body.lama, user.kata_sandi_hash):
        raise ApiError(422, "sandi_lama_salah", "Kata sandi saat ini tidak cocok.", "Periksa lagi kata sandi yang kamu pakai untuk masuk.")
    if body.baru == body.lama:
        raise ApiError(422, "sandi_sama", "Kata sandi baru sama dengan yang lama.", "Pakai kata sandi lain, minimal 10 karakter.")
    user.kata_sandi_hash = hash_rahasia(body.baru)
    sekarang = request.cookies.get(COOKIE_NAME)
    for s in db.scalars(select(SesiMasuk).where(SesiMasuk.pengguna_id == user.id, SesiMasuk.token != (sekarang or ""))):
        db.delete(s)
    audit(db, user, "kata_sandi_diubah", f"pengguna:{user.surel}")
    db.commit()
    return {"ok": True}


class Persetujuan(BaseModel):
    setuju: bool
    di_bawah_18: bool


@router.post("/persetujuan")
def persetujuan(body: Persetujuan, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """FR-1.2: persetujuan tersimpan dengan waktu, sebelum tes awal."""
    if not body.setuju:
        raise ApiError(422, "perlu_setuju", "Kamu perlu menyetujui penggunaan data untuk ikut tes dan latihan.", "Baca ringkasannya, lalu centang kotak persetujuan. Kamu boleh berhenti kapan saja.")
    r = ruang_utama(db, user)
    k = keanggotaan(db, user, r.id if r else None)
    if not k:
        raise ApiError(404, "tanpa_ruang", "Kamu belum tergabung di ruang mana pun.", "Masuk dengan kode ruang dari fasilitatormu.")
    k.persetujuan_data = True
    k.persetujuan_pada = datetime.now(timezone.utc)
    k.di_bawah_18 = body.di_bawah_18
    audit(db, user, "persetujuan_data", f"ruang:{r.kode}", {"di_bawah_18": body.di_bawah_18})
    db.commit()
    return {"profil": _profil(db, user)}


def _wajib_setuju(db: Session, user: Pengguna) -> tuple[RuangJeda | None, Keanggotaan | None]:
    r = ruang_utama(db, user)
    k = keanggotaan(db, user, r.id if r else None)
    if user.peran == "peserta" and not (k and k.persetujuan_data):
        raise ApiError(403, "perlu_persetujuan", "Kamu belum menyetujui penggunaan data.", "Buka halaman persetujuan, baca ringkasannya, lalu setujui untuk mulai.")
    return r, k


@router.get("/saya/data")
def unduh_data_saya(user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """Hak pengguna (Bab 11): melihat dan mengunduh data sendiri."""
    jejak = db.scalars(select(JejakVerifikasi).where(JejakVerifikasi.pengguna_id == user.id)).all()
    sesi = db.scalars(select(SesiLatihan).where(SesiLatihan.pengguna_id == user.id)).all()
    hasil = db.scalars(select(HasilAsesmen).where(HasilAsesmen.pengguna_id == user.id)).all()
    usulan = db.scalars(select(UsulanKartu).where(UsulanKartu.pengguna_id == user.id)).all()
    return {
        "diunduh_pada": datetime.now(timezone.utc).isoformat(),
        "akun": {"nama_samaran": user.nama_samaran, "peran": user.peran, "surel": user.surel, "dibuat_pada": _iso(user.dibuat_pada)},
        "jejak": [_jejak_dict(j) for j in jejak],
        "sesi_latihan": [{"id": s.id, "mode": s.mode, "kasus_id": s.kasus_id, "mulai": _iso(s.mulai), "selesai": _iso(s.selesai)} for s in sesi],
        "tes": [{"tipe": h.tipe, "perangkat": h.perangkat, "skor_akurasi": h.skor_akurasi, "skor_niat_berbagi": h.skor_niat_berbagi} for h in hasil],
        "usulan": [{"judul": u.judul, "status": u.status, "dibuat_pada": _iso(u.dibuat_pada)} for u in usulan],
    }


@router.delete("/saya")
def hapus_saya(response: Response, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    if user.peran != "peserta":
        raise ApiError(403, "akses_ditolak", "Akun tim dihapus oleh admin program.", "Hubungi admin program untuk menonaktifkan akunmu.")
    audit(db, None, "hapus_data_pengguna", "pengguna:anonim")
    hapus_data_pengguna(db, user)
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/notifikasi")
def notifikasi(user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    rows = db.scalars(select(Notifikasi).where(Notifikasi.pengguna_id == user.id).order_by(Notifikasi.waktu.desc()).limit(30)).all()
    return [{"id": n.id, "teks": n.teks, "tautan": n.tautan, "dibaca": n.dibaca, "waktu": _iso(n.waktu)} for n in rows]


@router.post("/notifikasi/baca")
def notifikasi_baca(user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notifikasi).where(Notifikasi.pengguna_id == user.id, Notifikasi.dibaca.is_(False))):
        n.dibaca = True
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- M2 latihan dan M3 cek


def kasus_dict(k: Kasus, lengkap: bool = True) -> dict:
    d = {
        "id": k.id,
        "judul": k.judul,
        "ringkasan": k.ringkasan,
        "tema": k.tema_kode,
        "teknik": k.teknik,
        "format": k.format_klaim,
        "tanggal_beredar": k.tanggal_beredar.isoformat() if k.tanggal_beredar else None,
        "tanggal_tinjau": k.tanggal_tinjau.isoformat() if k.tanggal_tinjau else None,
        "status": k.status,
        "pesan_prebunking": k.pesan_prebunking,
    }
    if lengkap:
        d["klaim"] = k.klaim
        d["konten"] = k.konten
    return d


@router.get("/kasus")
def daftar_kasus(teknik: str | None = None, tema: str | None = None, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """FR-5.1 dan FR-2.1: hanya kasus berstatus Terbit."""
    rows = db.scalars(select(Kasus).where(Kasus.status == "terbit").order_by(Kasus.diterbitkan_pada.desc(), Kasus.judul)).all()
    if teknik:
        rows = [k for k in rows if teknik in (k.teknik or [])]
    if tema:
        rows = [k for k in rows if k.tema_kode == tema]
    selesai = set(db.scalars(select(SesiLatihan.kasus_id).where(SesiLatihan.pengguna_id == user.id, SesiLatihan.selesai.is_not(None))).all())
    return [{**kasus_dict(k, lengkap=False), "sudah_dilatih": k.id in selesai} for k in rows]


@router.get("/kasus/{kasus_id}")
def ambil_kasus(kasus_id: str, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    k = db.get(Kasus, kasus_id)
    if not k or (k.status != "terbit" and user.peran not in ("pemeriksa", "admin")):
        raise ApiError(404, "kasus_tidak_ada", "Kasus ini tidak tersedia lagi.", "Pilih kasus lain dari bank kasus.")
    return kasus_dict(k)


class SesiBaru(BaseModel):
    id: str = Field(min_length=8, max_length=36)
    kasus_id: str | None = None
    mode: Literal["latihan", "cek"] = "latihan"
    mulai: datetime | None = None


@router.put("/sesi")
def mulai_sesi(body: SesiBaru, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """Idempoten: klien membuat ID sesi agar latihan bisa dimulai saat luring."""
    r, _ = _wajib_setuju(db, user)
    s = db.get(SesiLatihan, body.id)
    if s:
        if s.pengguna_id != user.id:
            raise ApiError(404, "sesi_tidak_ada", "Sesi tidak ditemukan.", "Mulai latihan baru dari halaman Latihan.")
        return _sesi_dict(db, s)
    if body.mode == "latihan":
        prof = _profil(db, user)
        if prof["latihan_terkunci"]:
            raise ApiError(403, "ruang_pembanding", "Ruangmu sedang menjadi ruang pembanding, jadi latihan dibuka setelah tes akhir.", "Kerjakan tes saat fasilitator membukanya. Terima kasih sudah membantu penelitian ini.")
        k = db.get(Kasus, body.kasus_id or "")
        if not k or k.status != "terbit":
            raise ApiError(404, "kasus_tidak_ada", "Kasus ini tidak tersedia lagi.", "Pilih kasus lain dari bank kasus.")
    s = SesiLatihan(id=body.id, pengguna_id=user.id, ruang_id=r.id if r else None, kasus_id=body.kasus_id if body.mode == "latihan" else None, mode=body.mode, mulai=body.mulai or datetime.now(timezone.utc))
    db.add(s)
    catat(db, "latihan_mulai", user=user, ruang_id=s.ruang_id, sesi_id=s.id, kasus_id=s.kasus_id, mode=s.mode)
    db.commit()
    return _sesi_dict(db, s)


def _sesi_dict(db: Session, s: SesiLatihan) -> dict:
    jaw = {j.tahap: {"jawaban": j.jawaban, "skor": j.skor, "diperbarui_pada": _iso(j.diperbarui_pada)} for j in db.scalars(select(JawabanTahap).where(JawabanTahap.sesi_id == s.id))}
    kep = db.scalars(select(KeputusanBerbagi).where(KeputusanBerbagi.sesi_id == s.id)).first()
    jejak = db.scalars(select(JejakVerifikasi.id).where(JejakVerifikasi.sesi_id == s.id)).first()
    return {
        "id": s.id,
        "kasus_id": s.kasus_id,
        "mode": s.mode,
        "tahap_terakhir": s.tahap_terakhir,
        "mulai": _iso(s.mulai),
        "selesai": _iso(s.selesai),
        "jawaban": jaw,
        "keputusan": {"q_bukti": kep.q_bukti, "q_untung": kep.q_untung, "q_akibat": kep.q_akibat, "tindakan": kep.tindakan, "niat": kep.niat_berbagi_skala} if kep else None,
        "jejak_id": jejak,
    }


def _sesi_milik(db: Session, user: Pengguna, sesi_id: str) -> SesiLatihan:
    s = db.get(SesiLatihan, sesi_id)
    if not s or s.pengguna_id != user.id:
        raise ApiError(404, "sesi_tidak_ada", "Sesi tidak ditemukan.", "Mulai latihan baru dari halaman Latihan.")
    return s


@router.get("/sesi/aktif")
def sesi_aktif(user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """FR-2.7: latihan dilanjutkan di tahap terakhir yang selesai."""
    s = db.scalars(select(SesiLatihan).where(SesiLatihan.pengguna_id == user.id, SesiLatihan.mode == "latihan", SesiLatihan.selesai.is_(None)).order_by(SesiLatihan.diperbarui_pada.desc())).first()
    return _sesi_dict(db, s) if s else None


@router.get("/sesi/{sesi_id}")
def ambil_sesi(sesi_id: str, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    return _sesi_dict(db, _sesi_milik(db, user, sesi_id))


class JawabanBody(BaseModel):
    jawaban: dict
    durasi_s: int = Field(default=0, ge=0, le=7200)
    diperbarui_pada: datetime | None = None


@router.put("/sesi/{sesi_id}/tahap/{tahap}")
def simpan_tahap(sesi_id: str, tahap: int, body: JawabanBody, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """FR-2.7 dan FR-8.2: simpan per tahap; konflik diselesaikan dengan waktu terbaru."""
    if tahap not in (1, 2, 3):
        raise ApiError(422, "tahap_tidak_sah", "Tahap tidak dikenal.", "Tahap 4 disimpan lewat Tombol JEDA.")
    s = _sesi_milik(db, user, sesi_id)
    k = db.get(Kasus, s.kasus_id) if s.kasus_id else None
    ts = body.diperbarui_pada or datetime.now(timezone.utc)
    j = db.scalars(select(JawabanTahap).where(JawabanTahap.sesi_id == s.id, JawabanTahap.tahap == tahap)).first()
    if j and _aware(j.diperbarui_pada) > _aware(ts):
        return _sesi_dict(db, s)
    skor = skor_tahap(k.konten, k.teknik, tahap, body.jawaban) if k else 0.0
    if not j:
        j = JawabanTahap(sesi_id=s.id, tahap=tahap)
        db.add(j)
        catat(db, "tahap_selesai", user=user, ruang_id=s.ruang_id, sesi_id=s.id, tahap=tahap, skor=skor, durasi=body.durasi_s)
    j.jawaban = body.jawaban
    j.skor = skor
    j.durasi_s = body.durasi_s
    j.diperbarui_pada = ts
    s.tahap_terakhir = max(s.tahap_terakhir, tahap)
    s.diperbarui_pada = ts
    db.commit()
    return _sesi_dict(db, s)


class JedaBody(BaseModel):
    q_bukti: str
    q_untung: str
    q_akibat: str
    tindakan: str
    niat: int = Field(ge=1, le=5)
    diperbarui_pada: datetime | None = None


@router.post("/sesi/{sesi_id}/jeda/buka")
def jeda_dibuka(sesi_id: str, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    s = _sesi_milik(db, user, sesi_id)
    catat(db, "tombol_jeda_dibuka", user=user, ruang_id=s.ruang_id, sesi_id=s.id, mode=s.mode)
    db.commit()
    return {"ok": True}


@router.post("/sesi/{sesi_id}/jeda")
def tombol_jeda(sesi_id: str, body: JedaBody, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """FR-2.5 dan Bab 8: tiga pertanyaan dijawab dan tepat satu tindakan dipilih."""
    s = _sesi_milik(db, user, sesi_id)
    for q in ("q_bukti", "q_untung", "q_akibat"):
        if getattr(body, q) not in JAWABAN_JEDA_SAH[q]:
            raise ApiError(422, "jeda_belum_lengkap", "Tiga pertanyaan Tombol JEDA belum terjawab semua.", "Jawab apa buktinya, siapa yang diuntungkan, dan apa akibatnya jika salah.")
    if body.tindakan not in TINDAKAN_SAH:
        raise ApiError(422, "tindakan_belum_dipilih", "Kamu belum memilih tindakan.", "Pilih satu dari lima tindakan di bawah pertanyaan.")
    kep = db.scalars(select(KeputusanBerbagi).where(KeputusanBerbagi.sesi_id == s.id)).first() or KeputusanBerbagi(sesi_id=s.id)
    kep.q_bukti, kep.q_untung, kep.q_akibat, kep.tindakan, kep.niat_berbagi_skala = body.q_bukti, body.q_untung, body.q_akibat, body.tindakan, body.niat
    db.add(kep)
    s.tahap_terakhir = 4
    s.selesai = s.selesai or body.diperbarui_pada or datetime.now(timezone.utc)
    s.diperbarui_pada = datetime.now(timezone.utc)
    catat(db, "tindakan_dipilih", user=user, ruang_id=s.ruang_id, sesi_id=s.id, tindakan=body.tindakan, q_bukti=body.q_bukti, q_untung=body.q_untung, q_akibat=body.q_akibat)
    db.commit()
    return _sesi_dict(db, s)


# ---------------------------------------------------------------- M4 jejak verifikasi


def _jejak_dict(j: JejakVerifikasi) -> dict:
    return {
        "id": j.id,
        "sesi_id": j.sesi_id,
        "mode": j.mode,
        "klaim": j.klaim,
        "sumber_primer": j.sumber_primer,
        "sumber_primer_url": j.sumber_primer_url,
        "pembanding": j.pembanding,
        "pembanding_url": j.pembanding_url,
        "tanggal_periksa": j.tanggal_periksa.isoformat() if j.tanggal_periksa else None,
        "konteks": j.konteks,
        "tindakan": j.tindakan,
        "catatan": j.catatan,
        "kelengkapan": j.kelengkapan,
        "kurang": unsur_kurang(j.sumber_primer, j.pembanding, j.tanggal_periksa, j.konteks),
        "dibuat_pada": _iso(j.dibuat_pada),
        "diperbarui_pada": _iso(j.diperbarui_pada),
    }


class JejakBody(BaseModel):
    id: str = Field(min_length=8, max_length=36)
    sesi_id: str | None = None
    klaim: str = Field(default="", max_length=CEK_MAKS_KARAKTER)
    sumber_primer: str = Field(default="", max_length=400)
    sumber_primer_url: str = Field(default="", max_length=400)
    pembanding: str = Field(default="", max_length=400)
    pembanding_url: str = Field(default="", max_length=400)
    tanggal_periksa: date | None = None
    konteks: str = Field(default="", max_length=600)
    catatan: str = Field(default="", max_length=600)
    diperbarui_pada: datetime | None = None


@router.get("/jejak")
def daftar_jejak(user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """FR-4.3 dan FR-4.6: hanya milik sendiri, terbaru lebih dulu."""
    rows = db.scalars(select(JejakVerifikasi).where(JejakVerifikasi.pengguna_id == user.id).order_by(JejakVerifikasi.dibuat_pada.desc())).all()
    return [_jejak_dict(j) for j in rows]


@router.put("/jejak")
def simpan_jejak(body: JejakBody, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """Latihan: jejak disusun dari jawaban tahap (FR-2.8). Cek: isi dari pengguna sendiri (FR-3.4, FR-3.5)."""
    r, _ = _wajib_setuju(db, user)
    j = db.get(JejakVerifikasi, body.id)
    if j and j.pengguna_id != user.id:
        raise ApiError(404, "jejak_tidak_ada", "Jejak tidak ditemukan.", "Buka daftar jejakmu untuk melihat jejak yang tersimpan.")
    ts = body.diperbarui_pada or datetime.now(timezone.utc)
    if j and _aware(j.diperbarui_pada) > _aware(ts):
        return _jejak_dict(j)
    s = _sesi_milik(db, user, body.sesi_id) if body.sesi_id else None
    if s and not s.selesai:
        raise ApiError(409, "jeda_belum", "Jejak disimpan setelah Tombol JEDA.", "Jawab tiga pertanyaan dan pilih satu tindakan dulu.")
    kep = db.scalars(select(KeputusanBerbagi).where(KeputusanBerbagi.sesi_id == s.id)).first() if s else None
    if s and s.mode == "latihan":
        k = db.get(Kasus, s.kasus_id)
        j2 = db.scalars(select(JawabanTahap).where(JawabanTahap.sesi_id == s.id, JawabanTahap.tahap == 2)).first()
        isi = susun_jejak_latihan(k.konten, k.judul, j2.jawaban if j2 else {}, body.tanggal_periksa or ts.date())
    else:
        isi = {
            "klaim": body.klaim.strip(),
            "sumber_primer": body.sumber_primer.strip(),
            "sumber_primer_url": body.sumber_primer_url.strip(),
            "pembanding": body.pembanding.strip(),
            "pembanding_url": body.pembanding_url.strip(),
            "tanggal_periksa": body.tanggal_periksa,
            "konteks": body.konteks.strip(),
        }
    baru = j is None
    if baru:
        j = JejakVerifikasi(id=body.id, pengguna_id=user.id, ruang_id=r.id if r else None, sesi_id=s.id if s else None, mode=s.mode if s else "cek", dibuat_pada=ts)
        db.add(j)
    for k_, v in isi.items():
        setattr(j, k_, v)
    j.catatan = body.catatan.strip()
    j.tindakan = kep.tindakan if kep else j.tindakan
    j.kelengkapan = hitung_kelengkapan(j.sumber_primer, j.pembanding, j.tanggal_periksa, j.konteks)
    j.diperbarui_pada = ts
    if baru:
        catat(db, "jejak_disimpan", user=user, ruang_id=j.ruang_id, sesi_id=j.sesi_id, kelengkapan=j.kelengkapan, mode=j.mode)
    db.commit()
    return _jejak_dict(j)


@router.get("/jejak/{jejak_id}")
def ambil_jejak(jejak_id: str, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    j = db.get(JejakVerifikasi, jejak_id)
    # FR-4.6: hanya pemilik. Peran lain, termasuk admin, mendapat 404 yang sama.
    if not j or j.pengguna_id != user.id:
        raise ApiError(404, "jejak_tidak_ada", "Jejak tidak ditemukan.", "Buka daftar jejakmu untuk melihat jejak yang tersimpan.")
    return _jejak_dict(j)


@router.delete("/jejak/{jejak_id}")
def hapus_jejak(jejak_id: str, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    j = db.get(JejakVerifikasi, jejak_id)
    if not j or j.pengguna_id != user.id:
        raise ApiError(404, "jejak_tidak_ada", "Jejak tidak ditemukan.", "Mungkin jejak ini sudah dihapus.")
    db.delete(j)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- M6 evaluasi


def _perangkat(k: Keanggotaan, tipe: str) -> str:
    return k.urutan_perangkat[0 if tipe == "awal" else 1]


@router.get("/tes/{tipe}")
def ambil_tes(tipe: Literal["awal", "akhir"], user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    r, k = _wajib_setuju(db, user)
    if not r or not k:
        raise ApiError(404, "tanpa_ruang", "Kamu belum tergabung di ruang mana pun.", "Masuk dengan kode ruang dari fasilitatormu.")
    sudah = db.scalars(select(HasilAsesmen).where(HasilAsesmen.pengguna_id == user.id, HasilAsesmen.ruang_id == r.id, HasilAsesmen.tipe == tipe)).first()
    if sudah:
        return {"selesai": True, "hasil": {"skor_akurasi": sudah.skor_akurasi, "skor_niat_berbagi": sudah.skor_niat_berbagi}}
    if not (r.tes_awal_buka if tipe == "awal" else r.tes_akhir_buka):
        raise ApiError(403, "tes_ditutup", f"Tes {tipe} belum dibuka di ruangmu.", "Fasilitator akan membukanya pada jadwal kegiatan. Coba lagi nanti.")
    if tipe == "akhir" and not db.scalar(select(HasilAsesmen.id).where(HasilAsesmen.pengguna_id == user.id, HasilAsesmen.ruang_id == r.id, HasilAsesmen.tipe == "awal")):
        raise ApiError(409, "tes_awal_dulu", "Tes akhir dikerjakan setelah tes awal.", "Kerjakan tes awal lebih dulu.")
    p = _perangkat(k, tipe)
    butir = db.scalars(select(ButirAsesmen).where(ButirAsesmen.perangkat == p).order_by(ButirAsesmen.urutan)).all()
    return {"selesai": False, "perangkat": p, "butir": [{"id": b.id, "klaim": b.klaim, "konteks": b.konteks} for b in butir]}


class TesBody(BaseModel):
    jawaban: dict[str, dict]


@router.post("/tes/{tipe}")
def kirim_tes(tipe: Literal["awal", "akhir"], body: TesBody, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    r, k = _wajib_setuju(db, user)
    if not r or not k:
        raise ApiError(404, "tanpa_ruang", "Kamu belum tergabung di ruang mana pun.", "Masuk dengan kode ruang dari fasilitatormu.")
    if not (r.tes_awal_buka if tipe == "awal" else r.tes_akhir_buka):
        raise ApiError(403, "tes_ditutup", f"Jendela tes {tipe} sudah ditutup.", "Jawabanmu belum terkirim. Minta fasilitator membuka jendela tes lagi.")
    if db.scalar(select(HasilAsesmen.id).where(HasilAsesmen.pengguna_id == user.id, HasilAsesmen.ruang_id == r.id, HasilAsesmen.tipe == tipe)):
        raise ApiError(409, "tes_sudah", "Kamu sudah mengerjakan tes ini.", "Hasilmu tersimpan di halaman Akun.")
    p = _perangkat(k, tipe)
    butir = [{"id": b.id, "label": b.label} for b in db.scalars(select(ButirAsesmen).where(ButirAsesmen.perangkat == p))]
    kosong = [b for b in butir if not (body.jawaban.get(b["id"]) or {}).get("label") or not isinstance((body.jawaban.get(b["id"]) or {}).get("niat"), int)]
    if kosong:
        raise ApiError(422, "tes_belum_lengkap", f"Masih ada {len(kosong)} butir yang belum dijawab.", "Setiap butir perlu penilaian klaim dan niat membagikan.")
    ak, ni = skor_asesmen(butir, body.jawaban)
    h = HasilAsesmen(pengguna_id=user.id, ruang_id=r.id, tipe=tipe, perangkat=p, jawaban=body.jawaban, skor_akurasi=ak, skor_niat_berbagi=ni)
    db.add(h)
    db.flush()
    catat(db, "tes_selesai", user=user, ruang_id=r.id, asesmen_id=h.id, skor_akurasi=ak, skor_niat_berbagi=ni)
    db.commit()
    pembahasan = {b.id: {"label": b.label, "penjelasan": b.penjelasan} for b in db.scalars(select(ButirAsesmen).where(ButirAsesmen.perangkat == p))}
    return {"skor_akurasi": ak, "skor_niat_berbagi": ni, "pembahasan": pembahasan if tipe == "akhir" else None}


class SusBody(BaseModel):
    jawaban: list[int] = Field(min_length=10, max_length=10)
    saran: str = Field(default="", max_length=500)


@router.post("/sus")
def kirim_sus(body: SusBody, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    r, _ = _wajib_setuju(db, user)
    if any(v not in (1, 2, 3, 4, 5) for v in body.jawaban):
        raise ApiError(422, "sus_tidak_sah", "Setiap pernyataan perlu dinilai 1 sampai 5.", "Pilih satu angka di setiap baris.")
    if not db.scalar(select(HasilAsesmen.id).where(HasilAsesmen.pengguna_id == user.id, HasilAsesmen.tipe == "akhir")):
        raise ApiError(409, "tes_akhir_dulu", "Survei dibuka setelah tes akhir.", "Kerjakan tes akhir lebih dulu.")
    if db.scalar(select(SurveiSUS.id).where(SurveiSUS.pengguna_id == user.id)):
        raise ApiError(409, "sus_sudah", "Kamu sudah mengisi survei ini. Terima kasih!", "")
    skor = skor_sus(body.jawaban)
    db.add(SurveiSUS(pengguna_id=user.id, ruang_id=r.id, jawaban=body.jawaban, skor=skor, saran=body.saran.strip()))
    db.commit()
    return {"skor": skor}
