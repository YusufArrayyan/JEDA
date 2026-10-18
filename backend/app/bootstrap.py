"""Pembuatan tabel, data awal, dan tugas terjadwal (retensi)."""

from __future__ import annotations

import logging
import os
import random
import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select

from . import content
from .config import COOKIE_SECURE, LAPORAN_PILOT_SELESAI, RETENSI_HARI, SEED_DEMO
from .db import Base, SessionLocal, engine
from .logic import hitung_kelengkapan, skor_asesmen, skor_sus, skor_tahap, susun_jejak_latihan
from .models import (
    ButirAsesmen,
    HasilAsesmen,
    JawabanTahap,
    JejakVerifikasi,
    Kasus,
    Keanggotaan,
    KeputusanBerbagi,
    LaporanKonten,
    LogAudit,
    Notifikasi,
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
    new_id,
)
from .security import hash_rahasia

log = logging.getLogger("jeda.bootstrap")

ALFABET_KODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # tanpa O/0 dan I/1 agar tidak tertukar


def kode_acak(n: int) -> str:
    return "".join(secrets.choice(ALFABET_KODE) for _ in range(n))


def kode_ruang_baru() -> str:
    """FR-1.4: unik, minimal 6 karakter acak, tidak mudah ditebak."""
    return f"JD-{kode_acak(4)}-{kode_acak(3)}"


def kode_pribadi_baru() -> str:
    return f"{kode_acak(4)}-{kode_acak(4)}"


def init_db() -> None:
    Base.metadata.create_all(engine)


def isi_konten_dasar(db) -> None:
    if not db.scalar(select(Teknik.id).limit(1)):
        for kode, nama, desk in content.TEKNIK:
            db.add(Teknik(kode=kode, nama=nama, deskripsi=desk))
        for kode, nama in content.TEMA:
            db.add(Tema(kode=kode, nama=nama))
    if not db.scalar(select(ButirAsesmen.id).limit(1)):
        for perangkat, butir in content.ASESMEN.items():
            for i, (klaim, konteks, label, penjelasan) in enumerate(butir):
                db.add(ButirAsesmen(perangkat=perangkat, urutan=i + 1, klaim=klaim, konteks=konteks, label=label, penjelasan=penjelasan))


def _konten_kasus(k: dict) -> dict:
    return {
        "petunjuk": [{"id": f"p{i}", **p} for i, p in enumerate(k["petunjuk"])],
        "kata_kunci": k["kata_kunci"],
        "sumber": [{"id": f"s{i}", **s} for i, s in enumerate(k["sumber"])],
        "pola": k["pola"],
        "konteks": k["konteks"],
    }


def seed() -> None:
    init_db()
    with SessionLocal() as db:
        isi_konten_dasar(db)
        db.commit()
        if db.scalar(select(Pengguna.id).limit(1)):
            return

        def staf(nama, peran, surel, env, bawaan):
            pw = os.getenv(env)
            if not pw:
                # Di penyebaran HTTPS, kata sandi bawaan README tidak pernah dipakai.
                pw = secrets.token_urlsafe(12) if COOKIE_SECURE else bawaan
                if COOKIE_SECURE:
                    log.warning("kata sandi awal %s (%s): %s — ganti setelah masuk", surel, peran, pw)
            u = Pengguna(nama_samaran=nama, peran=peran, surel=surel, kata_sandi_hash=hash_rahasia(pw))
            db.add(u)
            return u

        admin = staf("Admin Program", "admin", "admin@jeda.local", "JEDA_ADMIN_PASSWORD", "jeda-admin-2026")
        sari = staf("Sari", "fasilitator", "sari@jeda.local", "JEDA_FASILITATOR_PASSWORD", "jeda-fasilitator-2026")
        hendra = staf("Pak Hendra", "pemeriksa", "hendra@jeda.local", "JEDA_PEMERIKSA_PASSWORD", "jeda-pemeriksa-2026")
        db.flush()

        hari_ini = date.today()
        kasus_list: list[Kasus] = []
        for k in content.KASUS:
            ks = Kasus(
                judul=k["judul"],
                ringkasan=k["ringkasan"],
                klaim=k["klaim"],
                format_klaim=k["format"],
                tema_kode=k["tema"],
                teknik=k["teknik"],
                konten=_konten_kasus(k),
                tanggal_beredar=date.fromisoformat(k["tanggal_beredar"]),
                tanggal_tinjau=hari_ini + timedelta(days=120),
                status="terbit",
                penyusun_id=hendra.id,
                pesan_prebunking=k["prebunking"],
                diterbitkan_pada=datetime.now(timezone.utc),
            )
            db.add(ks)
            kasus_list.append(ks)
        db.flush()
        for ks in kasus_list:
            db.add(Telaah(kasus_id=ks.id, penelaah_id=hendra.id, penelaah_nama=hendra.nama_samaran, tahap="2", dari_status="ditelaah", ke_status="terbit", catatan="Divalidasi untuk bank kasus awal pilot."))

        db.add(LogAudit(aktor_nama="sistem", aksi="data_awal_dimuat", objek="basis_data", detail={"kasus": len(kasus_list), "demo": SEED_DEMO}))
        if not SEED_DEMO:
            # Mode pilot: hanya akun tim dan bank kasus. Ruang dibuat fasilitator; tidak ada akun peserta contoh.
            db.commit()
            log.info("data awal dimuat (tanpa data contoh)")
            return

        dimas = staf("Dimas", "fasilitator", "dimas@jeda.local", "JEDA_FASILITATOR_PASSWORD", "jeda-fasilitator-2026")
        db.flush()
        r07 = RuangJeda(nama="Ruang JEDA 07", kode="JD-07-BKL", wilayah="Kota Bengkulu", jenis_lembaga="sekolah", fasilitator_id=sari.id, tes_awal_buka=True, tes_akhir_buka=True)
        r12 = RuangJeda(nama="Ruang JEDA 12 Perpustakaan", kode=kode_ruang_baru(), wilayah="Kota Bengkulu", jenis_lembaga="perpustakaan", fasilitator_id=dimas.id, tes_awal_buka=True)
        r03 = RuangJeda(nama="Ruang Pembanding 03", kode=kode_ruang_baru(), wilayah="Bengkulu Tengah", jenis_lembaga="sekolah", fasilitator_id=sari.id, pembanding=True, tes_awal_buka=True, tes_akhir_buka=False)
        db.add_all([r07, r12, r03])
        db.flush()
        for r, f in ((r07, sari), (r12, dimas), (r03, sari)):
            db.add(Keanggotaan(pengguna_id=f.id, ruang_id=r.id, peran_ruang="fasilitator", persetujuan_data=True, persetujuan_pada=datetime.now(timezone.utc)))

        butir = {p: [{"id": b.id, "label": b.label} for b in db.scalars(select(ButirAsesmen).where(ButirAsesmen.perangkat == p))] for p in "AB"}

        # Peserta demo Rafi: kode pribadi tetap agar mudah dicoba.
        rafi = Pengguna(nama_samaran="Rafi", peran="peserta", kode_pribadi_hash=hash_rahasia("RAFI-2026"), kode_pribadi_petunjuk="RAFI")
        db.add(rafi)
        db.flush()
        db.add(Keanggotaan(pengguna_id=rafi.id, ruang_id=r07.id, persetujuan_data=True, persetujuan_pada=datetime.now(timezone.utc), di_bawah_18=True, wali_disetujui=True, wali_dicatat_pada=datetime.now(timezone.utc), urutan_perangkat="AB"))
        db.add(Notifikasi(pengguna_id=rafi.id, teks="Selamat datang di Ruang JEDA 07. Mulai dengan tes awal, lalu latihan pertamamu.", tautan="/tes/awal"))

        _isi_demo(db, r07, r12, r03, kasus_list, butir, sari, hendra)
        db.commit()
        log.info("data awal dimuat")


def _isi_demo(db, r07, r12, r03, kasus_list, butir, sari, hendra) -> None:
    """Peserta sintetis agar dasbor dapat diperagakan. Angkanya ilustrasi (FR-7.6)."""
    rng = random.Random(2026)
    awal_pilot = datetime.now(timezone.utc) - timedelta(days=34)
    nama = ["Ayu", "Bima", "Citra", "Dewi", "Eko", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kiki", "Lala", "Mira", "Nanda", "Oki", "Putri", "Raka", "Salsa", "Tiara", "Umar", "Vina", "Wulan", "Yoga", "Zahra"]

    def buat_peserta(ruang, n, perlakuan, akhir=True, prefix=""):
        for i in range(n):
            u = Pengguna(nama_samaran=f"{prefix}{nama[i % len(nama)]}", peran="peserta", dibuat_pada=awal_pilot)
            db.add(u)
            db.flush()
            bawah18 = rng.random() < 0.7
            # Dua peserta di bawah 18 belum punya persetujuan wali; mereka tidak masuk analisis.
            wali = not (bawah18 and i in (3, 11))
            urut = rng.choice(["AB", "BA"])
            db.add(Keanggotaan(pengguna_id=u.id, ruang_id=ruang.id, persetujuan_data=True, persetujuan_pada=awal_pilot, di_bawah_18=bawah18, wali_disetujui=wali, urutan_perangkat=urut, bergabung_pada=awal_pilot))

            base_ak = rng.uniform(0.38, 0.62)
            base_ni = rng.uniform(3.0, 4.2)
            for tipe, idx, delta_ak, delta_ni, hari in (("awal", 0, 0, 0, 1), ("akhir", 1, (0.11 if perlakuan else 0.0), (-0.65 if perlakuan else -0.05), 32)):
                if tipe == "akhir" and not akhir:
                    continue
                p = urut[idx]
                target = min(0.98, max(0.1, base_ak + delta_ak + rng.uniform(-0.08, 0.08)))
                jaw = {}
                for b in butir[p]:
                    benar = rng.random() < target
                    lbl = b["label"] if benar else rng.choice([x for x in ("benar", "keliru", "menyesatkan", "sintetis") if x != b["label"]])
                    ni = int(min(5, max(1, round(base_ni + delta_ni + rng.uniform(-0.9, 0.9)))))
                    jaw[b["id"]] = {"label": lbl, "niat": ni}
                ak, ni = skor_asesmen(butir[p], jaw)
                db.add(HasilAsesmen(pengguna_id=u.id, ruang_id=ruang.id, tipe=tipe, perangkat=p, jawaban=jaw, skor_akurasi=ak, skor_niat_berbagi=ni, selesai_pada=awal_pilot + timedelta(days=hari)))

            if not perlakuan:
                continue
            # Sebagian peserta jarang memilih pembanding independen, agar K3 contoh tidak sempurna.
            p_indep = 0.85 if rng.random() < 0.75 else 0.0
            for s_i in range(rng.randint(1, 4)):
                ks = rng.choice(kasus_list)
                mulai = awal_pilot + timedelta(days=3 + s_i * 6 + rng.randint(0, 3), hours=rng.randint(7, 15))
                selesai = rng.random() < 0.84
                sesi = SesiLatihan(id=new_id(), pengguna_id=u.id, ruang_id=ruang.id, kasus_id=ks.id, mode="latihan", tahap_terakhir=4 if selesai else rng.randint(1, 3), mulai=mulai, selesai=mulai + timedelta(minutes=rng.uniform(6.5, 13)) if selesai else None)
                db.add(sesi)
                db.flush()
                kn = ks.konten
                tepat = [p["id"] for p in kn["petunjuk"] if p["tepat"]]
                j1 = {"pilihan": rng.sample(tepat, 2) + [rng.choice([p["id"] for p in kn["petunjuk"]])]}
                prim = next(s["id"] for s in kn["sumber"] if s["jenis"] == "primer")
                indep = next(s["id"] for s in kn["sumber"] if s["jenis"] == "independen")
                bukan = next(s["id"] for s in kn["sumber"] if s["jenis"] == "bukan_independen")
                j2 = {"primer": prim, "pembanding": [indep] if rng.random() < p_indep else [bukan]}
                j3 = {"teknik": ks.teknik[:2] + ([] if rng.random() < 0.6 else ["dikotomi_semu"])}
                for t, j in ((1, j1), (2, j2), (3, j3)):
                    if t <= sesi.tahap_terakhir:
                        db.add(JawabanTahap(sesi_id=sesi.id, tahap=t, jawaban=j, skor=skor_tahap(kn, ks.teknik, t, j), durasi_s=rng.randint(70, 220)))
                if selesai:
                    tind = rng.choice(["tunda", "tunda", "koreksi", "laporkan", "bagikan_konteks", "abaikan"])
                    db.add(KeputusanBerbagi(sesi_id=sesi.id, q_bukti=rng.choice(["hanya_unggahan", "ada_primer", "ada_pembanding"]), q_untung=rng.choice(["pembuat_tautan", "pembuat_konten"]), q_akibat=rng.choice(["data_dicuri", "uang_hilang", "panik"]), tindakan=tind, niat_berbagi_skala=rng.randint(1, 3)))
                    jj = susun_jejak_latihan(kn, ks.judul, j2, sesi.selesai.date())
                    kl = hitung_kelengkapan(jj["sumber_primer"], jj["pembanding"], jj["tanggal_periksa"], jj["konteks"])
                    db.add(JejakVerifikasi(id=new_id(), sesi_id=sesi.id, pengguna_id=u.id, ruang_id=ruang.id, mode="latihan", tindakan=tind, kelengkapan=kl, dibuat_pada=sesi.selesai, diperbarui_pada=sesi.selesai, **jj))
            if rng.random() < 0.35:
                mulai = awal_pilot + timedelta(days=rng.randint(8, 30))
                db.add(SesiLatihan(id=new_id(), pengguna_id=u.id, ruang_id=ruang.id, mode="cek", tahap_terakhir=4, mulai=mulai, selesai=mulai + timedelta(minutes=4)))
            if rng.random() < 0.8:
                jaw = [rng.choice([4, 5]) if k % 2 == 0 else rng.choice([1, 2]) for k in range(10)]
                db.add(SurveiSUS(pengguna_id=u.id, ruang_id=ruang.id, jawaban=jaw, skor=skor_sus(jaw), dibuat_pada=awal_pilot + timedelta(days=33)))

    buat_peserta(r07, 24, True)
    buat_peserta(r12, 4, True, akhir=False)
    buat_peserta(r03, 9, False, prefix="P-")
    db.flush()

    peserta07 = db.scalars(select(Keanggotaan.pengguna_id).where(Keanggotaan.ruang_id == r07.id, Keanggotaan.peran_ruang == "peserta")).all()

    def usulan(status, judul, teknik, tema, klaim, bukti, pesan, idx):
        u = UsulanKartu(pengguna_id=peserta07[idx], ruang_id=r07.id, jenis="kartu", judul=judul, klaim=klaim, teknik_kode=teknik, tema_kode=tema, bukti=bukti, pesan_prebunking=pesan, keselamatan={"tanpa_wajah": True, "tidak_mempermalukan": True, "bertanda_simulasi": True, "tanpa_data_pribadi": True}, status=status)
        db.add(u)
        db.flush()
        alur = {"diajukan": [], "ditelaah": [("1", "diajukan", "ditelaah", sari)], "terbit": [("1", "diajukan", "ditelaah", sari), ("2", "ditelaah", "terbit", hendra)], "ditolak": [("1", "diajukan", "ditolak", sari)]}[status]
        db.add(Telaah(usulan_id=u.id, penelaah_nama="Pengaju", tahap="pengaju", dari_status="draf", ke_status="diajukan", catatan=""))
        for tahap, dari, ke, siapa in alur:
            cat = "Butir keselamatan lengkap, lanjut ke pemeriksa fakta." if ke == "ditelaah" else ("Bukti sesuai sumber primer. Terbit." if ke == "terbit" else "Kartu menyebut nama sekolah nyata. Hapus nama itu lalu ajukan lagi.")
            db.add(Telaah(usulan_id=u.id, penelaah_id=siapa.id, penelaah_nama=siapa.nama_samaran, tahap=tahap, dari_status=dari, ke_status=ke, catatan=cat))

    usulan("terbit", "Kode OTP hanya untukmu", "tautan_tiruan", "keuangan", "Pesan hadiah meminta kode OTP yang dikirim lewat SMS.", "Operator dan bank menyatakan tidak pernah meminta OTP.", "Ada yang minta kode OTP? Itu tanda bahaya. Kode OTP hanya untukmu, siapa pun yang memintanya.", 0)
    usulan("terbit", "Cek tanggal sebelum panik", "potongan_konteks", "bencana", "Foto banjir lama dibagikan ulang seolah terjadi hari ini.", "Pencarian gambar terbalik menemukan foto terbit 2019.", "Foto asli bisa menyesatkan bila waktunya diganti. Cari asal foto sebelum meneruskan.", 1)
    usulan("terbit", "Beasiswa tidak minta transfer", "desakan_waktu", "pendidikan", "Beasiswa dengan kuota tinggal sedikit dan biaya administrasi.", "Portal beasiswa resmi tidak mencantumkan program ini.", "Kuota tinggal sedikit dan bayar dulu? Berhenti sebentar. Beasiswa resmi tidak memungut biaya lewat transfer pribadi.", 2)
    usulan("terbit", "Suara mirip, belum tentu dia", "visual_ai", "keuangan", "Pesan suara mirip kepala sekolah meminta transfer uang komite.", "Sekolah tidak pernah meminta transfer lewat pesan suara.", "Suara bisa ditiru. Telepon balik ke nomor yang kamu kenal sebelum mentransfer apa pun.", 4)
    usulan("terbit", "Relawan resmi punya izin", "dikotomi_semu", "bantuan_sosial", "Ajakan donasi ke rekening pribadi atas nama relawan.", "Daftar izin penggalangan dana tidak memuat kelompok ini.", "Mau membantu? Lewat posko resmi. Rasa bersalah bukan alasan meneruskan pesan.", 5)
    usulan("ditelaah", "Lowongan berbayar itu tanda bahaya", "otoritas_palsu", "lowongan_kerja", "Lowongan tambang meminta biaya seragam sebelum wawancara.", "Dinas tenaga kerja tidak mencatat lowongan ini.", "Lamaran kerja resmi tidak memungut biaya. Cek lowongan di situs perusahaan.", 6)
    usulan("diajukan", "Awan bukan peramal gempa", "visual_ai", "bencana", "Gambar awan berpilin disebut tanda gempa dalam 48 jam.", "BMKG menjelaskan gempa belum bisa diprediksi waktunya.", "Gempa belum bisa diprediksi lewat bentuk awan. Siaga boleh, panik karena gambar buatan jangan.", 7)
    usulan("ditolak", "Surat libur palsu", "otoritas_palsu", "pendidikan", "Surat libur lama beredar lagi.", "Dinas pendidikan tidak menerbitkan surat baru.", "Cek tanggal surat sebelum meneruskan.", 8)

    db.add(LaporanKonten(kasus_id=kasus_list[7].id, pelapor_id=peserta07[9], alasan="kedaluwarsa", keterangan="Pedoman kesehatan yang dirujuk mungkin sudah diperbarui."))
    db.add(RekapLuring(ruang_id=r07.id, tanggal=(awal_pilot + timedelta(days=12)).date(), jumlah_peserta=14, latihan_selesai=12, jejak_lengkap=9, kasus_dipakai="Surat biaya transaksi bank", pembuat_id=sari.id))
    db.add(RekapLuring(ruang_id=r07.id, tanggal=(awal_pilot + timedelta(days=26)).date(), jumlah_peserta=11, latihan_selesai=11, jejak_lengkap=8, kasus_dipakai="Foto banjir Sungai Bengkulu hari ini", pembuat_id=sari.id))


def hapus_data_pengguna(db, user: Pengguna) -> None:
    """FR-1.5: hapus data pribadi. Skor tes dilepas dari identitas (agregat anonim tetap)."""
    db.execute(delete(SesiMasuk).where(SesiMasuk.pengguna_id == user.id))
    db.execute(delete(JejakVerifikasi).where(JejakVerifikasi.pengguna_id == user.id))
    db.execute(delete(SesiLatihan).where(SesiLatihan.pengguna_id == user.id))
    db.execute(delete(Notifikasi).where(Notifikasi.pengguna_id == user.id))
    db.execute(delete(Keanggotaan).where(Keanggotaan.pengguna_id == user.id))
    for h in db.scalars(select(HasilAsesmen).where(HasilAsesmen.pengguna_id == user.id)):
        h.pengguna_id = None
        h.jawaban = {}
    for s in db.scalars(select(SurveiSUS).where(SurveiSUS.pengguna_id == user.id)):
        s.pengguna_id = None
        s.saran = ""
    for u in db.scalars(select(UsulanKartu).where(UsulanKartu.pengguna_id == user.id)):
        u.pengguna_id = None
    db.delete(user)


def jalankan_retensi() -> dict:
    """FR-9.6: anonimkan data perseorangan RETENSI_HARI setelah laporan pilot selesai. Hasil dicatat di log audit."""
    batas = date.fromisoformat(LAPORAN_PILOT_SELESAI) + timedelta(days=RETENSI_HARI)
    hasil = {"batas": batas.isoformat(), "dianonimkan": 0, "sesi_kedaluwarsa": 0}
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        r = db.execute(delete(SesiMasuk).where(SesiMasuk.kedaluwarsa < now))
        hasil["sesi_kedaluwarsa"] = r.rowcount or 0
        if date.today() >= batas:
            for u in db.scalars(select(Pengguna).where(Pengguna.peran == "peserta", Pengguna.dianonimkan.is_(False))):
                u.nama_samaran = "Anonim"
                u.surel = None
                u.kode_pribadi_hash = None
                u.kode_pribadi_petunjuk = None
                u.aktif = False
                u.dianonimkan = True
                for j in db.scalars(select(JejakVerifikasi).where(JejakVerifikasi.pengguna_id == u.id)):
                    j.klaim = j.catatan = j.konteks = ""
                hasil["dianonimkan"] += 1
        db.add(LogAudit(aktor_nama="sistem", aksi="retensi_dijalankan", objek="pengguna", detail=hasil))
        db.commit()
    return hasil
