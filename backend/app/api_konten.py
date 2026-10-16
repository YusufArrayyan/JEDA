"""API M5 bank kasus & studio kartu, telaah dua tahap, kelola kasus, laporan konten, dan berkas cetak."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .api_peserta import kasus_dict
from .config import BATAS_USULAN_PER_MINGGU
from .db import get_db
from .models import Kasus, LaporanKonten, Notifikasi, Pengguna, RuangJeda, Teknik, Telaah, UsulanKartu, new_id
from .pdf import kartu_prebunking, set_kartu_luring
from .security import ApiError, audit, catat, pengguna_aktif, perlu_peran, ruang_utama

router = APIRouter(prefix="/api")

KESELAMATAN = ("tanpa_wajah", "tidak_mempermalukan", "bertanda_simulasi", "tanpa_data_pribadi")


def _iso(dt):
    return dt.isoformat() if dt else None


def _nama_teknik(db: Session) -> dict[str, str]:
    return {t.kode: t.nama for t in db.scalars(select(Teknik))}


def _riwayat(db: Session, *, usulan_id: str | None = None, kasus_id: str | None = None) -> list[dict]:
    q = select(Telaah).order_by(Telaah.waktu)
    q = q.where(Telaah.usulan_id == usulan_id) if usulan_id else q.where(Telaah.kasus_id == kasus_id)
    return [{"tahap": t.tahap, "dari": t.dari_status, "ke": t.ke_status, "penelaah": t.penelaah_nama, "catatan": t.catatan, "waktu": _iso(t.waktu)} for t in db.scalars(q)]


def _usulan_dict(db: Session, u: UsulanKartu, riwayat: bool = False) -> dict:
    d = {
        "id": u.id,
        "jenis": u.jenis,
        "judul": u.judul,
        "klaim": u.klaim,
        "teknik": u.teknik_kode,
        "tema": u.tema_kode,
        "bukti": u.bukti,
        "pesan_prebunking": u.pesan_prebunking,
        "status": u.status,
        "dibuat_pada": _iso(u.dibuat_pada),
        "diperbarui_pada": _iso(u.diperbarui_pada),
    }
    if riwayat:
        d["riwayat"] = _riwayat(db, usulan_id=u.id)
    return d


# ---------------------------------------------------------------- bank kasus


@router.get("/kartu")
def kartu_terbit(teknik: str | None = None, tema: str | None = None, _: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    q = select(UsulanKartu).where(UsulanKartu.status == "terbit").order_by(UsulanKartu.diperbarui_pada.desc())
    if teknik:
        q = q.where(UsulanKartu.teknik_kode == teknik)
    if tema:
        q = q.where(UsulanKartu.tema_kode == tema)
    return [_usulan_dict(db, u) for u in db.scalars(q)]


def _pdf(data: bytes, nama: str) -> Response:
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{nama}"'})


@router.get("/kartu/{usulan_id}/pdf")
def kartu_pdf(usulan_id: str, _: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    u = db.get(UsulanKartu, usulan_id)
    if not u or u.status != "terbit":
        raise ApiError(404, "kartu_tidak_ada", "Kartu ini belum atau tidak lagi terbit.", "Pilih kartu lain dari bank kasus.")
    return _pdf(kartu_prebunking(u.judul, _nama_teknik(db).get(u.teknik_kode, u.teknik_kode), u.klaim, u.pesan_prebunking, u.bukti), f"kartu-jeda-{u.id[:8]}.pdf")


@router.get("/kasus/{kasus_id}/pdf")
def kasus_pdf(kasus_id: str, _: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    k = db.get(Kasus, kasus_id)
    if not k or k.status != "terbit":
        raise ApiError(404, "kasus_tidak_ada", "Kasus ini tidak tersedia lagi.", "Pilih kasus lain dari bank kasus.")
    nt = _nama_teknik(db)
    return _pdf(kartu_prebunking(k.judul, ", ".join(nt.get(t, t) for t in k.teknik), k.klaim, k.pesan_prebunking), f"kasus-jeda-{k.id[:8]}.pdf")


@router.get("/luring/kartu-cetak.pdf")
def set_luring(_: Pengguna = Depends(perlu_peran("fasilitator", "admin")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Kasus).where(Kasus.status == "terbit").order_by(Kasus.judul)).all()
    return _pdf(set_kartu_luring([kasus_dict(k) for k in rows], _nama_teknik(db)), "set-kartu-luring-jeda.pdf")


class LaporBody(BaseModel):
    alasan: Literal["kedaluwarsa", "keliru", "tidak_aman", "lainnya"]
    keterangan: str = Field(default="", max_length=400)


@router.post("/kasus/{kasus_id}/lapor")
def lapor_kasus(kasus_id: str, body: LaporBody, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    if not db.get(Kasus, kasus_id):
        raise ApiError(404, "kasus_tidak_ada", "Kasus ini tidak ditemukan.", "")
    db.add(LaporanKonten(kasus_id=kasus_id, pelapor_id=user.id, alasan=body.alasan, keterangan=body.keterangan.strip()))
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- studio kartu


class UsulanBody(BaseModel):
    jenis: Literal["kasus", "kartu"] = "kartu"
    judul: str = Field(default="", max_length=120)
    klaim: str = Field(default="", max_length=600)
    teknik: str = Field(default="", max_length=32)
    tema: str = Field(default="", max_length=32)
    bukti: str = Field(default="", max_length=600)
    pesan_prebunking: str = Field(default="", max_length=400)
    keselamatan: dict[str, bool] = {}
    draf: bool = False


@router.post("/usulan")
def ajukan(body: UsulanBody, user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    """FR-5.2 dan FR-5.3: semua bidang wajib dan seluruh daftar periksa keselamatan."""
    if not body.draf:
        galat = {}
        for f, label in (("judul", "Judul"), ("klaim", "Klaim"), ("teknik", "Teknik"), ("tema", "Tema"), ("bukti", "Bukti"), ("pesan_prebunking", "Pesan prebunking")):
            if not str(getattr(body, f)).strip():
                galat[f] = f"{label} belum diisi."
        if galat:
            raise ApiError(422, "usulan_belum_lengkap", "Ada bidang yang belum diisi: " + ", ".join(v.split(" ")[0] for v in galat.values()) + ".", "Lengkapi bidang yang ditandai, lalu ajukan lagi.")
        if not all(body.keselamatan.get(k) for k in KESELAMATAN):
            raise ApiError(422, "keselamatan_belum", "Daftar periksa keselamatan belum dicentang semua.", "Pastikan keempat butir terpenuhi sebelum mengajukan.")
    seminggu = datetime.now(timezone.utc) - timedelta(days=7)
    jumlah = len(db.scalars(select(UsulanKartu.id).where(UsulanKartu.pengguna_id == user.id, UsulanKartu.dibuat_pada >= seminggu)).all())
    if jumlah >= BATAS_USULAN_PER_MINGGU:
        raise ApiError(429, "batas_usulan", f"Kamu sudah mengajukan {jumlah} usulan minggu ini.", "Batasnya lima usulan per minggu agar penelaah tidak kewalahan. Coba lagi minggu depan.")
    r = ruang_utama(db, user)
    u = UsulanKartu(
        pengguna_id=user.id,
        ruang_id=r.id if r else None,
        jenis=body.jenis,
        judul=body.judul.strip() or "Tanpa judul",
        klaim=body.klaim.strip(),
        teknik_kode=body.teknik,
        tema_kode=body.tema,
        bukti=body.bukti.strip(),
        pesan_prebunking=body.pesan_prebunking.strip(),
        keselamatan={k: bool(body.keselamatan.get(k)) for k in KESELAMATAN},
        status="draf" if body.draf else "diajukan",
    )
    db.add(u)
    db.flush()
    if not body.draf:
        db.add(Telaah(usulan_id=u.id, penelaah_id=user.id, penelaah_nama="Pengaju", tahap="pengaju", dari_status="draf", ke_status="diajukan"))
        catat(db, "kartu_diajukan", user=user, ruang_id=u.ruang_id, usulan_id=u.id, status="diajukan")
    db.commit()
    return _usulan_dict(db, u, riwayat=True)


@router.get("/usulan/saya")
def usulan_saya(user: Pengguna = Depends(pengguna_aktif), db: Session = Depends(get_db)):
    rows = db.scalars(select(UsulanKartu).where(UsulanKartu.pengguna_id == user.id).order_by(UsulanKartu.diperbarui_pada.desc())).all()
    return [_usulan_dict(db, u, riwayat=True) for u in rows]


# ---------------------------------------------------------------- telaah dua tahap


@router.get("/telaah")
def antrean_telaah(user: Pengguna = Depends(perlu_peran("fasilitator", "pemeriksa", "admin")), db: Session = Depends(get_db)):
    """Fasilitator menelaah tahap 1 dari ruangnya; pemeriksa fakta tahap 2 (FR-5.4)."""
    if user.peran == "fasilitator":
        ruang = db.scalars(select(RuangJeda.id).where(RuangJeda.fasilitator_id == user.id)).all()
        rows = db.scalars(select(UsulanKartu).where(UsulanKartu.status == "diajukan", UsulanKartu.ruang_id.in_(ruang)).order_by(UsulanKartu.dibuat_pada)).all()
    elif user.peran == "pemeriksa":
        rows = db.scalars(select(UsulanKartu).where(UsulanKartu.status == "ditelaah").order_by(UsulanKartu.diperbarui_pada)).all()
    else:
        rows = db.scalars(select(UsulanKartu).where(UsulanKartu.status.in_(("diajukan", "ditelaah"))).order_by(UsulanKartu.diperbarui_pada)).all()
    out = []
    for u in rows:
        d = _usulan_dict(db, u, riwayat=True)
        d["keselamatan"] = u.keselamatan
        out.append(d)
    return out


class TelaahBody(BaseModel):
    keputusan: Literal["lolos", "tolak", "kembalikan", "terbit", "tarik"]
    catatan: str = Field(default="", max_length=600)


_TRANSISI = {
    ("fasilitator", "diajukan", "lolos"): "ditelaah",
    ("fasilitator", "diajukan", "tolak"): "ditolak",
    ("fasilitator", "diajukan", "kembalikan"): "draf",
    ("pemeriksa", "ditelaah", "terbit"): "terbit",
    ("pemeriksa", "ditelaah", "tolak"): "ditolak",
    ("pemeriksa", "ditelaah", "kembalikan"): "draf",
    ("pemeriksa", "terbit", "tarik"): "diarsipkan",
}


@router.post("/usulan/{usulan_id}/telaah")
def telaah(usulan_id: str, body: TelaahBody, user: Pengguna = Depends(perlu_peran("fasilitator", "pemeriksa", "admin")), db: Session = Depends(get_db)):
    u = db.get(UsulanKartu, usulan_id)
    if not u:
        raise ApiError(404, "usulan_tidak_ada", "Usulan tidak ditemukan.", "Muat ulang antrean telaah.")
    peran = user.peran
    if peran == "admin":
        # Admin bertindak sebagai moderator; tetap mengikuti alur status yang sama.
        peran = "fasilitator" if u.status == "diajukan" else "pemeriksa"
    if user.peran == "fasilitator" and not db.scalar(select(RuangJeda.id).where(RuangJeda.id == u.ruang_id, RuangJeda.fasilitator_id == user.id)):
        raise ApiError(403, "akses_ditolak", "Usulan ini berasal dari ruang lain.", "Fasilitator hanya menelaah usulan dari ruangnya sendiri.")
    ke = _TRANSISI.get((peran, u.status, body.keputusan))
    if not ke:
        raise ApiError(409, "transisi_tidak_sah", f"Usulan berstatus {u.status} tidak bisa diberi keputusan '{body.keputusan}' oleh peranmu.", "Muat ulang antrean; mungkin penelaah lain sudah memprosesnya.")
    if ke in ("ditolak", "draf") and not body.catatan.strip():
        raise ApiError(422, "perlu_catatan", "Tulis alasan agar pengaju tahu apa yang perlu diperbaiki.", "Isi kolom catatan dengan satu atau dua kalimat.")
    dari = u.status
    u.status = ke
    u.diperbarui_pada = datetime.now(timezone.utc)
    tahap = "1" if peran == "fasilitator" else "2"
    db.add(Telaah(usulan_id=u.id, penelaah_id=user.id, penelaah_nama=user.nama_samaran, tahap=tahap, dari_status=dari, ke_status=ke, catatan=body.catatan.strip()))
    audit(db, user, f"telaah_{ke}", f"usulan:{u.id}", {"dari": dari, "tahap": tahap})
    if ke == "terbit":
        catat(db, "kartu_terbit", user=user, ruang_id=u.ruang_id, usulan_id=u.id, status="terbit")
    pesan = {
        "ditelaah": f"Usulanmu \"{u.judul}\" lolos telaah fasilitator dan diteruskan ke pemeriksa fakta.",
        "terbit": f"Kartumu \"{u.judul}\" terbit di bank kasus. Terima kasih sudah membantu teman-temanmu.",
        "ditolak": f"Usulan \"{u.judul}\" belum bisa terbit. Catatan penelaah: {body.catatan.strip()}",
        "draf": f"Usulan \"{u.judul}\" dikembalikan untuk diperbaiki. Catatan: {body.catatan.strip()}",
        "diarsipkan": f"Kartu \"{u.judul}\" ditarik dari bank kasus. Catatan: {body.catatan.strip()}",
    }[ke]
    if u.pengguna_id:
        # FR-5.5: notifikasi dalam aplikasi.
        db.add(Notifikasi(pengguna_id=u.pengguna_id, teks=pesan[:300], tautan="/ruang/usulan"))
    db.commit()
    return _usulan_dict(db, u, riwayat=True)


# ---------------------------------------------------------------- kelola kasus latihan (pemeriksa fakta, admin)


class PetunjukIn(BaseModel):
    teks: str = Field(min_length=3, max_length=200)
    tepat: bool
    alasan: str = Field(min_length=3, max_length=300)


class SumberIn(BaseModel):
    teks: str = Field(min_length=3, max_length=200)
    jenis: Literal["primer", "independen", "bukan_independen", "bukan_sumber"]
    alasan: str = Field(min_length=3, max_length=300)
    url: str = Field(default="", max_length=300)


class KasusIn(BaseModel):
    judul: str = Field(min_length=3, max_length=120)
    ringkasan: str = Field(min_length=3, max_length=600)
    klaim: str = Field(min_length=3, max_length=1000)
    format: Literal["pesan", "unggahan", "surat", "gambar"] = "pesan"
    tema: str
    teknik: list[str] = Field(min_length=1)
    tanggal_beredar: date | None = None
    tanggal_tinjau: date | None = None
    kata_kunci: list[str] = Field(min_length=1, max_length=5)
    petunjuk: list[PetunjukIn] = Field(min_length=4, max_length=8)
    sumber: list[SumberIn] = Field(min_length=3, max_length=6)
    pola: str = Field(default="", max_length=400)
    konteks: str = Field(min_length=3, max_length=400)
    pesan_prebunking: str = Field(min_length=3, max_length=400)


def _validasi_kasus(body: KasusIn) -> None:
    if sum(p.tepat for p in body.petunjuk) != 3:
        raise ApiError(422, "petunjuk_tepat", "Tahap 1 perlu tepat tiga petunjuk yang benar.", "Tandai tiga petunjuk sebagai tepat, sisanya sebagai pengecoh.")
    jenis = [s.jenis for s in body.sumber]
    if jenis.count("primer") != 1 or "independen" not in jenis:
        raise ApiError(422, "sumber_kurang", "Tahap 2 perlu tepat satu sumber primer dan sedikitnya satu pembanding independen.", "Atur jenis setiap sumber.")


def _konten(body: KasusIn) -> dict:
    return {
        "petunjuk": [{"id": f"p{i}", **p.model_dump()} for i, p in enumerate(body.petunjuk)],
        "kata_kunci": [k.strip() for k in body.kata_kunci if k.strip()],
        "sumber": [{"id": f"s{i}", **s.model_dump()} for i, s in enumerate(body.sumber)],
        "pola": body.pola.strip(),
        "konteks": body.konteks.strip(),
    }


@router.get("/kelola/kasus")
def kelola_daftar(_: Pengguna = Depends(perlu_peran("pemeriksa", "admin")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Kasus).order_by(Kasus.dibuat_pada.desc())).all()
    laporan = {}
    for lp in db.scalars(select(LaporanKonten).where(LaporanKonten.status == "baru")):
        laporan[lp.kasus_id] = laporan.get(lp.kasus_id, 0) + 1
    return [{**kasus_dict(k, lengkap=False), "laporan_baru": laporan.get(k.id, 0)} for k in rows]


@router.get("/kelola/kasus/{kasus_id}")
def kelola_ambil(kasus_id: str, _: Pengguna = Depends(perlu_peran("pemeriksa", "admin")), db: Session = Depends(get_db)):
    k = db.get(Kasus, kasus_id)
    if not k:
        raise ApiError(404, "kasus_tidak_ada", "Kasus tidak ditemukan.", "")
    return {**kasus_dict(k), "riwayat": _riwayat(db, kasus_id=k.id)}


@router.post("/kelola/kasus")
def kelola_buat(body: KasusIn, user: Pengguna = Depends(perlu_peran("pemeriksa", "admin")), db: Session = Depends(get_db)):
    _validasi_kasus(body)
    k = Kasus(id=new_id(), judul=body.judul.strip(), ringkasan=body.ringkasan.strip(), klaim=body.klaim.strip(), format_klaim=body.format, tema_kode=body.tema, teknik=body.teknik, konten=_konten(body), tanggal_beredar=body.tanggal_beredar, tanggal_tinjau=body.tanggal_tinjau, status="ditelaah", penyusun_id=user.id, pesan_prebunking=body.pesan_prebunking.strip())
    db.add(k)
    db.add(Telaah(kasus_id=k.id, penelaah_id=user.id, penelaah_nama=user.nama_samaran, tahap="2", dari_status="draf", ke_status="ditelaah", catatan="Kasus baru disusun."))
    audit(db, user, "kasus_dibuat", f"kasus:{k.id}")
    db.commit()
    return kasus_dict(k)


@router.put("/kelola/kasus/{kasus_id}")
def kelola_ubah(kasus_id: str, body: KasusIn, user: Pengguna = Depends(perlu_peran("pemeriksa", "admin")), db: Session = Depends(get_db)):
    k = db.get(Kasus, kasus_id)
    if not k:
        raise ApiError(404, "kasus_tidak_ada", "Kasus tidak ditemukan.", "")
    _validasi_kasus(body)
    k.judul, k.ringkasan, k.klaim, k.format_klaim = body.judul.strip(), body.ringkasan.strip(), body.klaim.strip(), body.format
    k.tema_kode, k.teknik, k.konten = body.tema, body.teknik, _konten(body)
    k.tanggal_beredar, k.tanggal_tinjau, k.pesan_prebunking = body.tanggal_beredar, body.tanggal_tinjau, body.pesan_prebunking.strip()
    audit(db, user, "kasus_diubah", f"kasus:{k.id}")
    db.commit()
    return kasus_dict(k)


class StatusKasus(BaseModel):
    status: Literal["terbit", "diarsipkan", "ditelaah"]
    catatan: str = Field(default="", max_length=400)


@router.post("/kelola/kasus/{kasus_id}/status")
def kelola_status(kasus_id: str, body: StatusKasus, user: Pengguna = Depends(perlu_peran("pemeriksa", "admin")), db: Session = Depends(get_db)):
    """FR-5.7: kasus ditarik berstatus Diarsipkan dan hilang dari latihan baru."""
    k = db.get(Kasus, kasus_id)
    if not k:
        raise ApiError(404, "kasus_tidak_ada", "Kasus tidak ditemukan.", "")
    if body.status == "terbit" and user.peran != "pemeriksa":
        raise ApiError(403, "akses_ditolak", "Hanya pemeriksa fakta yang dapat menerbitkan kasus.", "Minta pemeriksa fakta memvalidasi kasus ini.")
    if body.status == "diarsipkan" and not body.catatan.strip():
        raise ApiError(422, "perlu_catatan", "Tulis alasan penarikan kasus.", "Misalnya: rujukan sudah kedaluwarsa.")
    dari = k.status
    k.status = body.status
    if body.status == "terbit":
        k.diterbitkan_pada = datetime.now(timezone.utc)
    db.add(Telaah(kasus_id=k.id, penelaah_id=user.id, penelaah_nama=user.nama_samaran, tahap="2" if user.peran == "pemeriksa" else "moderasi", dari_status=dari, ke_status=body.status, catatan=body.catatan.strip()))
    audit(db, user, {"terbit": "kasus_terbit", "diarsipkan": "kasus_ditarik", "ditelaah": "kasus_dikembalikan"}[body.status], f"kasus:{k.id}", {"catatan": body.catatan.strip()[:120]})
    db.commit()
    return kasus_dict(k)
