"""Sesi cookie httpOnly, Argon2, kontrol peran, batas laju, galat seragam, audit, dan peristiwa."""

from __future__ import annotations

import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import SESSION_DAYS
from .db import get_db
from .models import Keanggotaan, LogAudit, Pengguna, Peristiwa, RuangJeda, SesiMasuk

COOKIE_NAME = "jeda_sesi"
# Hak akses kumulatif sesuai Bab 5, kecuali pemeriksa fakta yang tidak memegang ruang.
PERAN_LABEL = {"peserta": "Peserta", "fasilitator": "Fasilitator", "pemeriksa": "Pemeriksa fakta", "admin": "Admin"}

_ph = PasswordHasher()


class ApiError(HTTPException):
    """Galat seragam: apa yang terjadi, lalu cara memperbaikinya (Bab 10.4)."""

    def __init__(self, status: int, code: str, message: str, hint: str = ""):
        super().__init__(status_code=status, detail={"code": code, "message": message, "hint": hint})


def hash_rahasia(pw: str) -> str:
    return _ph.hash(pw)


def cocok_rahasia(pw: str, h: str | None) -> bool:
    if not h:
        return False
    try:
        return _ph.verify(h, pw)
    except (VerifyMismatchError, InvalidHashError):
        return False


def buat_sesi(db: Session, user: Pengguna) -> SesiMasuk:
    tok = SesiMasuk(token=secrets.token_urlsafe(32), pengguna_id=user.id, kedaluwarsa=datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS))
    db.add(tok)
    db.commit()
    return tok


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def pengguna_opsional(request: Request, db: Session = Depends(get_db)) -> Pengguna | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    s = db.get(SesiMasuk, token)
    if not s or _aware(s.kedaluwarsa) < datetime.now(timezone.utc):
        return None
    user = db.get(Pengguna, s.pengguna_id)
    if not user or not user.aktif:
        return None
    return user


def pengguna_aktif(user: Pengguna | None = Depends(pengguna_opsional)) -> Pengguna:
    if user is None:
        raise ApiError(401, "belum_masuk", "Kamu belum masuk atau sesimu sudah berakhir.", "Masuk lagi dengan kode ruang atau kode pribadimu.")
    return user


def perlu_peran(*peran: str):
    def dep(user: Pengguna = Depends(pengguna_aktif)) -> Pengguna:
        if user.peran not in peran:
            label = " atau ".join(PERAN_LABEL[p] for p in peran)
            raise ApiError(403, "akses_ditolak", f"Tindakan ini hanya untuk {label}.", "Minta admin program mengubah peranmu bila ini memang tugasmu.")
        return user

    return dep


def ruang_utama(db: Session, user: Pengguna) -> RuangJeda | None:
    """Ruang aktif pengguna: ruang yang dipegang fasilitator, atau ruang terakhir yang diikuti peserta."""
    if user.peran == "fasilitator":
        r = db.scalars(select(RuangJeda).where(RuangJeda.fasilitator_id == user.id).order_by(RuangJeda.dibuat_pada.desc())).first()
        if r:
            return r
    k = db.scalars(select(Keanggotaan).where(Keanggotaan.pengguna_id == user.id).order_by(Keanggotaan.bergabung_pada.desc())).first()
    return db.get(RuangJeda, k.ruang_id) if k else None


def keanggotaan(db: Session, user: Pengguna, ruang_id: str | None) -> Keanggotaan | None:
    if not ruang_id:
        return None
    return db.scalars(select(Keanggotaan).where(Keanggotaan.pengguna_id == user.id, Keanggotaan.ruang_id == ruang_id)).first()


def audit(db: Session, user: Pengguna | None, aksi: str, objek: str = "", detail: dict | None = None) -> None:
    db.add(LogAudit(aktor_id=user.id if user else None, aktor_nama=(user.nama_samaran if user else "sistem"), aksi=aksi, objek=objek, detail=detail))


# Properti yang boleh dicatat per peristiwa (Bab 12.1). Teks bebas tidak pernah masuk.
_PROPS_SAH = {
    "latihan_mulai": {"kasus_id", "mode"},
    "tahap_selesai": {"tahap", "skor", "durasi"},
    "tombol_jeda_dibuka": {"mode"},
    "tindakan_dipilih": {"tindakan", "q_bukti", "q_untung", "q_akibat"},
    "jejak_disimpan": {"kelengkapan", "mode"},
    "kartu_diajukan": {"usulan_id", "status"},
    "kartu_terbit": {"usulan_id", "status"},
    "tes_selesai": {"asesmen_id", "skor_akurasi", "skor_niat_berbagi"},
}


def catat(db: Session, nama: str, *, user: Pengguna | None = None, ruang_id: str | None = None, sesi_id: str | None = None, **props) -> None:
    sah = _PROPS_SAH[nama]
    db.add(Peristiwa(nama=nama, ruang_id=ruang_id, sesi_id=sesi_id, pengguna_id=user.id if user else None, props={k: v for k, v in props.items() if k in sah}))


class RateLimiter:
    def __init__(self, limit: int, window_s: float):
        self.limit = limit
        self.window = window_s
        self.hits: dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise ApiError(429, "terlalu_sering", "Terlalu banyak percobaan dalam waktu singkat.", "Tunggu satu menit, lalu coba lagi.")
        q.append(now)


masuk_limiter = RateLimiter(10, 60)
api_limiter = RateLimiter(900, 60)
