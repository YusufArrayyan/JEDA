"""Model data JEDA, mengikuti diagram relasi entitas PRD Lampiran B7."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


PERAN = ("peserta", "fasilitator", "pemeriksa", "admin")
STATUS_KASUS = ("draf", "diajukan", "ditelaah", "terbit", "ditolak", "diarsipkan")
TINDAKAN = ("tunda", "koreksi", "laporkan", "bagikan_konteks", "abaikan")


class Pengguna(Base):
    __tablename__ = "pengguna"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    nama_samaran: Mapped[str] = mapped_column(String(40))
    peran: Mapped[str] = mapped_column(String(16), default="peserta")
    surel: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    kata_sandi_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Peserta masuk kembali dengan kode pribadi (dihash), bukan kata sandi.
    kode_pribadi_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    kode_pribadi_petunjuk: Mapped[str | None] = mapped_column(String(8), nullable=True, index=True)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)
    dianonimkan: Mapped[bool] = mapped_column(Boolean, default=False)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SesiMasuk(Base):
    __tablename__ = "sesi_masuk"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    pengguna_id: Mapped[str] = mapped_column(ForeignKey("pengguna.id", ondelete="CASCADE"), index=True)
    kedaluwarsa: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RuangJeda(Base):
    __tablename__ = "ruang_jeda"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    nama: Mapped[str] = mapped_column(String(80))
    kode: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    wilayah: Mapped[str] = mapped_column(String(80), default="Kota Bengkulu")
    jenis_lembaga: Mapped[str] = mapped_column(String(40), default="sekolah")
    fasilitator_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)
    # FR-6.3: ruang pembanding hanya mengerjakan tes.
    pembanding: Mapped[bool] = mapped_column(Boolean, default=False)
    # FR-6.4: jendela tes dibuka dan ditutup fasilitator.
    tes_awal_buka: Mapped[bool] = mapped_column(Boolean, default=False)
    tes_akhir_buka: Mapped[bool] = mapped_column(Boolean, default=False)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Keanggotaan(Base):
    __tablename__ = "keanggotaan"
    __table_args__ = (UniqueConstraint("pengguna_id", "ruang_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    pengguna_id: Mapped[str] = mapped_column(ForeignKey("pengguna.id", ondelete="CASCADE"), index=True)
    ruang_id: Mapped[str] = mapped_column(ForeignKey("ruang_jeda.id", ondelete="CASCADE"), index=True)
    peran_ruang: Mapped[str] = mapped_column(String(16), default="peserta")
    persetujuan_data: Mapped[bool] = mapped_column(Boolean, default=False)
    persetujuan_pada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    di_bawah_18: Mapped[bool] = mapped_column(Boolean, default=False)
    # FR-1.3: persetujuan orang tua/wali dicatat fasilitator.
    wali_disetujui: Mapped[bool] = mapped_column(Boolean, default=False)
    wali_dicatat_pada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # FR-6.1: urutan perangkat soal diacak per peserta ("AB" atau "BA").
    urutan_perangkat: Mapped[str] = mapped_column(String(2), default="AB")
    bergabung_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Teknik(Base):
    __tablename__ = "teknik"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(32), unique=True)
    nama: Mapped[str] = mapped_column(String(60))
    deskripsi: Mapped[str] = mapped_column(Text, default="")
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)


class Tema(Base):
    __tablename__ = "tema"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(32), unique=True)
    nama: Mapped[str] = mapped_column(String(60))
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)


class Kasus(Base):
    __tablename__ = "kasus"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    judul: Mapped[str] = mapped_column(String(120))
    ringkasan: Mapped[str] = mapped_column(Text)
    klaim: Mapped[str] = mapped_column(Text)
    format_klaim: Mapped[str] = mapped_column(String(24), default="pesan")  # pesan, unggahan, surat, gambar
    tema_kode: Mapped[str] = mapped_column(String(32))
    teknik: Mapped[list] = mapped_column(JSON, default=list)  # kode teknik yang benar
    # Isi tahap: petunjuk (tahap 1), kata_kunci & sumber (tahap 2), pola (tahap 3), konteks, jeda.
    konten: Mapped[dict] = mapped_column(JSON, default=dict)
    sumber_url: Mapped[str] = mapped_column(String(300), default="")
    tanggal_beredar: Mapped[date | None] = mapped_column(Date, nullable=True)
    tanggal_tinjau: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="draf", index=True)
    penyusun_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True)
    pesan_prebunking: Mapped[str] = mapped_column(Text, default="")
    diterbitkan_pada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SesiLatihan(Base):
    __tablename__ = "sesi_latihan"
    # ID dibuat klien agar sesi dapat dimulai saat luring (FR-8.2).
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    pengguna_id: Mapped[str] = mapped_column(ForeignKey("pengguna.id", ondelete="CASCADE"), index=True)
    ruang_id: Mapped[str | None] = mapped_column(ForeignKey("ruang_jeda.id", ondelete="SET NULL"), nullable=True, index=True)
    kasus_id: Mapped[str | None] = mapped_column(ForeignKey("kasus.id", ondelete="SET NULL"), nullable=True)
    mode: Mapped[str] = mapped_column(String(8), default="latihan")  # latihan | cek
    tahap_terakhir: Mapped[int] = mapped_column(Integer, default=0)
    mulai: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    selesai: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    diperbarui_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class JawabanTahap(Base):
    __tablename__ = "jawaban_tahap"
    __table_args__ = (UniqueConstraint("sesi_id", "tahap"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    sesi_id: Mapped[str] = mapped_column(ForeignKey("sesi_latihan.id", ondelete="CASCADE"), index=True)
    tahap: Mapped[int] = mapped_column(Integer)
    jawaban: Mapped[dict] = mapped_column(JSON, default=dict)
    skor: Mapped[float] = mapped_column(Float, default=0)
    durasi_s: Mapped[int] = mapped_column(Integer, default=0)
    diperbarui_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class KeputusanBerbagi(Base):
    __tablename__ = "keputusan_berbagi"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    sesi_id: Mapped[str] = mapped_column(ForeignKey("sesi_latihan.id", ondelete="CASCADE"), unique=True)
    q_bukti: Mapped[str] = mapped_column(String(32))
    q_untung: Mapped[str] = mapped_column(String(32))
    q_akibat: Mapped[str] = mapped_column(String(32))
    tindakan: Mapped[str] = mapped_column(String(20))
    niat_berbagi_skala: Mapped[int] = mapped_column(Integer)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class JejakVerifikasi(Base):
    __tablename__ = "jejak_verifikasi"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    sesi_id: Mapped[str | None] = mapped_column(ForeignKey("sesi_latihan.id", ondelete="SET NULL"), nullable=True)
    pengguna_id: Mapped[str] = mapped_column(ForeignKey("pengguna.id", ondelete="CASCADE"), index=True)
    ruang_id: Mapped[str | None] = mapped_column(ForeignKey("ruang_jeda.id", ondelete="SET NULL"), nullable=True, index=True)
    mode: Mapped[str] = mapped_column(String(8), default="latihan")
    klaim: Mapped[str] = mapped_column(Text, default="")
    sumber_primer: Mapped[str] = mapped_column(Text, default="")
    sumber_primer_url: Mapped[str] = mapped_column(String(400), default="")
    pembanding: Mapped[str] = mapped_column(Text, default="")
    pembanding_url: Mapped[str] = mapped_column(String(400), default="")
    tanggal_periksa: Mapped[date | None] = mapped_column(Date, nullable=True)
    konteks: Mapped[str] = mapped_column(Text, default="")
    tindakan: Mapped[str] = mapped_column(String(20), default="")
    catatan: Mapped[str] = mapped_column(Text, default="")
    kelengkapan: Mapped[int] = mapped_column(Integer, default=0)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    diperbarui_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class UsulanKartu(Base):
    __tablename__ = "usulan_kartu"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    pengguna_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True, index=True)
    ruang_id: Mapped[str | None] = mapped_column(ForeignKey("ruang_jeda.id", ondelete="SET NULL"), nullable=True, index=True)
    jenis: Mapped[str] = mapped_column(String(8), default="kartu")  # kasus | kartu
    judul: Mapped[str] = mapped_column(String(120))
    klaim: Mapped[str] = mapped_column(Text)
    teknik_kode: Mapped[str] = mapped_column(String(32))
    tema_kode: Mapped[str] = mapped_column(String(32))
    bukti: Mapped[str] = mapped_column(Text)
    pesan_prebunking: Mapped[str] = mapped_column(Text)
    keselamatan: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="diajukan", index=True)
    kasus_id: Mapped[str | None] = mapped_column(ForeignKey("kasus.id", ondelete="SET NULL"), nullable=True)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    diperbarui_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Telaah(Base):
    """Setiap perpindahan status kasus/usulan (FR-5.4)."""

    __tablename__ = "telaah"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    usulan_id: Mapped[str | None] = mapped_column(ForeignKey("usulan_kartu.id", ondelete="CASCADE"), nullable=True, index=True)
    kasus_id: Mapped[str | None] = mapped_column(ForeignKey("kasus.id", ondelete="CASCADE"), nullable=True, index=True)
    penelaah_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True)
    penelaah_nama: Mapped[str] = mapped_column(String(40), default="")
    tahap: Mapped[str] = mapped_column(String(16))  # 1, 2, moderasi, pengaju
    dari_status: Mapped[str] = mapped_column(String(16))
    ke_status: Mapped[str] = mapped_column(String(16))
    catatan: Mapped[str] = mapped_column(Text, default="")
    waktu: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Notifikasi(Base):
    __tablename__ = "notifikasi"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    pengguna_id: Mapped[str] = mapped_column(ForeignKey("pengguna.id", ondelete="CASCADE"), index=True)
    teks: Mapped[str] = mapped_column(String(300))
    tautan: Mapped[str] = mapped_column(String(120), default="")
    dibaca: Mapped[bool] = mapped_column(Boolean, default=False)
    waktu: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LaporanKonten(Base):
    """Laporan peserta atas kasus atau kartu terbit (FR-9.2)."""

    __tablename__ = "laporan_konten"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    kasus_id: Mapped[str] = mapped_column(ForeignKey("kasus.id", ondelete="CASCADE"), index=True)
    pelapor_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True)
    alasan: Mapped[str] = mapped_column(String(32))
    keterangan: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="baru")  # baru | ditindak | ditolak
    catatan_moderator: Mapped[str] = mapped_column(Text, default="")
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    ditindak_pada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ButirAsesmen(Base):
    __tablename__ = "butir_asesmen"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    perangkat: Mapped[str] = mapped_column(String(1), index=True)  # A | B
    urutan: Mapped[int] = mapped_column(Integer)
    klaim: Mapped[str] = mapped_column(Text)
    konteks: Mapped[str] = mapped_column(String(160), default="")
    label: Mapped[str] = mapped_column(String(16))  # benar | keliru | menyesatkan | sintetis
    penjelasan: Mapped[str] = mapped_column(Text, default="")


class HasilAsesmen(Base):
    __tablename__ = "hasil_asesmen"
    __table_args__ = (UniqueConstraint("pengguna_id", "ruang_id", "tipe"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    pengguna_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True, index=True)
    ruang_id: Mapped[str] = mapped_column(ForeignKey("ruang_jeda.id", ondelete="CASCADE"), index=True)
    tipe: Mapped[str] = mapped_column(String(8))  # awal | akhir
    perangkat: Mapped[str] = mapped_column(String(1))
    jawaban: Mapped[dict] = mapped_column(JSON, default=dict)
    skor_akurasi: Mapped[float] = mapped_column(Float)
    skor_niat_berbagi: Mapped[float] = mapped_column(Float)
    selesai_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SurveiSUS(Base):
    __tablename__ = "survei_sus"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    pengguna_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True, unique=True)
    ruang_id: Mapped[str] = mapped_column(ForeignKey("ruang_jeda.id", ondelete="CASCADE"), index=True)
    jawaban: Mapped[list] = mapped_column(JSON, default=list)
    skor: Mapped[float] = mapped_column(Float)
    saran: Mapped[str] = mapped_column(Text, default="")
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RekapLuring(Base):
    __tablename__ = "rekap_luring"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    ruang_id: Mapped[str] = mapped_column(ForeignKey("ruang_jeda.id", ondelete="CASCADE"), index=True)
    tanggal: Mapped[date] = mapped_column(Date)
    jumlah_peserta: Mapped[int] = mapped_column(Integer)
    latihan_selesai: Mapped[int] = mapped_column(Integer)
    jejak_lengkap: Mapped[int] = mapped_column(Integer)
    kasus_dipakai: Mapped[str] = mapped_column(String(120), default="")
    pembuat_id: Mapped[str | None] = mapped_column(ForeignKey("pengguna.id", ondelete="SET NULL"), nullable=True)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Peristiwa(Base):
    """Peristiwa analitik (Bab 12.1). Tidak pernah memuat teks bebas."""

    __tablename__ = "peristiwa"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nama: Mapped[str] = mapped_column(String(32), index=True)
    ruang_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    sesi_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    pengguna_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    waktu: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class LogAudit(Base):
    """Log audit hanya-tambah (FR-9.3). Tidak ada API untuk mengubah atau menghapusnya."""

    __tablename__ = "log_audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    aktor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    aktor_nama: Mapped[str] = mapped_column(String(60), default="sistem")
    aksi: Mapped[str] = mapped_column(String(40), index=True)
    objek: Mapped[str] = mapped_column(String(120), default="")
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    waktu: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)

