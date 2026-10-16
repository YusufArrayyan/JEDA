"""Uji penerimaan untuk kebutuhan bertanda M di PRD Bab 7."""

import csv
import io
import uuid

from conftest import masuk_rafi, masuk_staf

from app.logic import hitung_kelengkapan, skor_sus


def _id():
    return str(uuid.uuid4())


def test_kode_ruang_tidak_valid_tidak_membocorkan(client):
    """FR-1.1: kode salah dan kode nonaktif memberi pesan yang sama."""
    r = client.post("/api/masuk/ruang", json={"kode": "JD-XX-NOPE", "nama_samaran": "Tes"})
    assert r.status_code == 404
    assert r.json()["error"]["message"] == "Kode ruang tidak ditemukan."
    assert "fasilitator" in r.json()["error"]["hint"]


def test_alur_peserta_baru_sampai_jejak(client):
    r = client.post("/api/masuk/ruang", json={"kode": "jd-07-bkl", "nama_samaran": "Uji Alur"})
    assert r.status_code == 200
    assert len(r.json()["kode_pribadi"]) == 9
    # FR-1.2: tanpa persetujuan, tes ditolak.
    assert client.get("/api/tes/awal").json()["error"]["code"] == "perlu_persetujuan"
    assert client.post("/api/persetujuan", json={"setuju": True, "di_bawah_18": False}).status_code == 200

    tes = client.get("/api/tes/awal").json()
    assert len(tes["butir"]) == 8
    # Tes belum lengkap ditolak dengan jumlah butir yang kurang.
    r = client.post("/api/tes/awal", json={"jawaban": {}})
    assert r.status_code == 422 and "8 butir" in r.json()["error"]["message"]
    jaw = {b["id"]: {"label": "keliru", "niat": 2} for b in tes["butir"]}
    r = client.post("/api/tes/awal", json={"jawaban": jaw})
    assert r.status_code == 200 and r.json()["skor_akurasi"] == 25.0

    kasus = client.get("/api/kasus").json()
    assert len(kasus) >= 12 and all(k["status"] == "terbit" for k in kasus)
    k = client.get(f"/api/kasus/{kasus[0]['id']}").json()
    sid = _id()
    assert client.put("/api/sesi", json={"id": sid, "kasus_id": k["id"], "mode": "latihan"}).status_code == 200
    # Idempoten: mengirim ulang (sinkronisasi luring) tidak membuat sesi ganda.
    assert client.put("/api/sesi", json={"id": sid, "kasus_id": k["id"], "mode": "latihan"}).status_code == 200

    tepat = [p["id"] for p in k["konten"]["petunjuk"] if p["tepat"]]
    s = client.put(f"/api/sesi/{sid}/tahap/1", json={"jawaban": {"pilihan": tepat}}).json()
    assert s["jawaban"]["1"]["skor"] == 1.0
    prim = next(x["id"] for x in k["konten"]["sumber"] if x["jenis"] == "primer")
    bukan = next(x["id"] for x in k["konten"]["sumber"] if x["jenis"] == "bukan_independen")
    client.put(f"/api/sesi/{sid}/tahap/2", json={"jawaban": {"primer": prim, "pembanding": [bukan]}})
    client.put(f"/api/sesi/{sid}/tahap/3", json={"jawaban": {"teknik": k["teknik"]}})
    # FR-2.7: sesi dapat dilanjutkan.
    assert client.get("/api/sesi/aktif").json()["tahap_terakhir"] == 3

    # FR-2.5: tidak dapat lanjut tanpa tiga jawaban dan satu tindakan.
    r = client.post(f"/api/sesi/{sid}/jeda", json={"q_bukti": "x", "q_untung": "pembuat_tautan", "q_akibat": "panik", "tindakan": "tunda", "niat": 2})
    assert r.status_code == 422
    r = client.post(f"/api/sesi/{sid}/jeda", json={"q_bukti": "hanya_unggahan", "q_untung": "pembuat_tautan", "q_akibat": "panik", "tindakan": "", "niat": 2})
    assert r.json()["error"]["code"] == "tindakan_belum_dipilih"
    r = client.post(f"/api/sesi/{sid}/jeda", json={"q_bukti": "hanya_unggahan", "q_untung": "pembuat_tautan", "q_akibat": "panik", "tindakan": "tunda", "niat": 2})
    assert r.status_code == 200 and r.json()["selesai"]

    # FR-2.8 + FR-4.2: pembanding tidak independen membuat jejak belum lengkap.
    j = client.put("/api/jejak", json={"id": _id(), "sesi_id": sid}).json()
    assert j["kelengkapan"] == 3 and j["kurang"] == ["pembanding"]
    assert j["tindakan"] == "tunda"

    # Perbaiki tahap 2 dengan waktu lebih baru, lalu susun ulang jejak.
    indep = next(x["id"] for x in k["konten"]["sumber"] if x["jenis"] == "independen")
    client.put(f"/api/sesi/{sid}/tahap/2", json={"jawaban": {"primer": prim, "pembanding": [indep]}})
    j2 = client.put("/api/jejak", json={"id": j["id"], "sesi_id": sid}).json()
    assert j2["kelengkapan"] == 4


def test_konflik_luring_waktu_terbaru_menang(client):
    masuk_rafi(client)
    k = client.get("/api/kasus").json()[1]
    sid = _id()
    client.put("/api/sesi", json={"id": sid, "kasus_id": k["id"], "mode": "latihan"})
    client.put(f"/api/sesi/{sid}/tahap/1", json={"jawaban": {"pilihan": ["p0"]}, "diperbarui_pada": "2026-10-16T10:00:00Z"})
    s = client.put(f"/api/sesi/{sid}/tahap/1", json={"jawaban": {"pilihan": ["p5"]}, "diperbarui_pada": "2026-10-16T09:00:00Z"}).json()
    assert s["jawaban"]["1"]["jawaban"]["pilihan"] == ["p0"]


def test_cek_jeda_tidak_menyimpan_klaim_tanpa_sengaja(client):
    """FR-3.5: klaim hanya tersimpan bila dimasukkan ke jejak sendiri."""
    masuk_rafi(client)
    sid = _id()
    assert client.put("/api/sesi", json={"id": sid, "mode": "cek"}).status_code == 200
    client.post(f"/api/sesi/{sid}/jeda", json={"q_bukti": "belum_tahu", "q_untung": "tidak_jelas", "q_akibat": "panik", "tindakan": "tunda", "niat": 3})
    j = client.put("/api/jejak", json={"id": _id(), "sesi_id": sid, "klaim": "", "sumber_primer": "Situs resmi", "tanggal_periksa": "2026-10-16", "konteks": "Grup kelas"}).json()
    assert j["mode"] == "cek" and j["klaim"] == "" and j["kelengkapan"] == 3


def test_fasilitator_dan_admin_tidak_bisa_membaca_jejak(client):
    """FR-4.6 dan kriteria rilis 6."""
    masuk_rafi(client)
    jid = client.get("/api/jejak").json()[0]["id"]
    for surel, pw in (("sari@jeda.local", "jeda-fasilitator-2026"), ("admin@jeda.local", "jeda-admin-2026")):
        client.post("/api/keluar")
        masuk_staf(client, surel, pw)
        assert client.get(f"/api/jejak/{jid}").status_code == 404
        assert all(j["id"] != jid for j in client.get("/api/jejak").json())


def test_peserta_tidak_bisa_membuka_dasbor_atau_admin(client):
    """FR-1.6: uji akses menolak tindakan di luar peran."""
    masuk_rafi(client)
    for path in ("/api/dasbor", "/api/admin/audit", "/api/telaah", "/api/ruang", "/api/admin/ekspor"):
        assert client.get(path).status_code == 403, path
    masuk_staf(client, "sari@jeda.local", "jeda-fasilitator-2026")
    assert client.get("/api/admin/audit").status_code == 403
    assert client.get("/api/kelola/kasus").status_code == 403


def test_dasbor_menutup_kelompok_kecil(client):
    """FR-7.2: ruang 4 peserta menampilkan data belum cukup."""
    masuk_staf(client, "dimas@jeda.local", "jeda-fasilitator-2026")
    d = client.get("/api/dasbor").json()
    p = d["perlakuan"]
    assert p["peserta_aktif"]["tertutup"] is True and p["peserta_aktif"]["nilai"] is None
    assert p["k1"]["tertutup"] is True


def test_dasbor_ruang_besar_dan_csv_tanpa_nama(client):
    masuk_staf(client, "sari@jeda.local", "jeda-fasilitator-2026")
    d = client.get("/api/dasbor").json()
    p = d["perlakuan"]
    assert p["peserta_aktif"]["nilai"] >= 5
    assert p["k1"]["nilai"] is not None and p["k1"]["nilai"] > 0
    assert p["k2"]["nilai"] is not None and p["k2"]["nilai"] < 0
    assert d["pembanding"] is not None
    r = client.get("/api/dasbor/csv")
    teks = r.content.decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(teks)))
    assert rows and "nama_samaran" not in rows[0]
    for nama in ("Ayu", "Bima", "Rafi"):
        assert nama not in teks


def test_ekspor_anonim_tanpa_teks_bebas(client):
    masuk_staf(client, "admin@jeda.local", "jeda-admin-2026")
    teks = client.get("/api/admin/ekspor").content.decode("utf-8-sig")
    assert "P0001" in teks
    for bocor in ("Ayu", "Rafi", "@jeda.local", "Situs resmi"):
        assert bocor not in teks


def test_usulan_wajib_lengkap_dan_aman_lalu_dua_tahap_telaah(client):
    masuk_rafi(client)
    r = client.post("/api/usulan", json={"judul": "Kartu uji", "klaim": "", "teknik": "", "tema": "", "bukti": "", "pesan_prebunking": ""})
    assert r.status_code == 422 and "Klaim" in r.json()["error"]["message"]
    isi = {"judul": "Kartu uji", "klaim": "Klaim", "teknik": "desakan_waktu", "tema": "keuangan", "bukti": "Bukti", "pesan_prebunking": "Pesan"}
    r = client.post("/api/usulan", json={**isi, "keselamatan": {"tanpa_wajah": True}})
    assert r.json()["error"]["code"] == "keselamatan_belum"
    aman = {k: True for k in ("tanpa_wajah", "tidak_mempermalukan", "bertanda_simulasi", "tanpa_data_pribadi")}
    u = client.post("/api/usulan", json={**isi, "keselamatan": aman}).json()
    assert u["status"] == "diajukan"

    # Pemeriksa fakta tidak bisa melompati tahap 1.
    masuk_staf(client, "hendra@jeda.local", "jeda-pemeriksa-2026")
    assert client.post(f"/api/usulan/{u['id']}/telaah", json={"keputusan": "terbit"}).status_code == 409

    masuk_staf(client, "sari@jeda.local", "jeda-fasilitator-2026")
    assert client.post(f"/api/usulan/{u['id']}/telaah", json={"keputusan": "tolak"}).json()["error"]["code"] == "perlu_catatan"
    assert client.post(f"/api/usulan/{u['id']}/telaah", json={"keputusan": "lolos"}).json()["status"] == "ditelaah"

    masuk_staf(client, "hendra@jeda.local", "jeda-pemeriksa-2026")
    t = client.post(f"/api/usulan/{u['id']}/telaah", json={"keputusan": "terbit", "catatan": "Sesuai sumber."}).json()
    assert t["status"] == "terbit"
    assert [x["ke"] for x in t["riwayat"]] == ["diajukan", "ditelaah", "terbit"]
    assert all(x["waktu"] for x in t["riwayat"])
    pdf = client.get(f"/api/kartu/{u['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"

    masuk_rafi(client)
    assert any("terbit" in n["teks"] for n in client.get("/api/notifikasi").json())


def test_tarik_kasus_hilang_dari_latihan(client):
    """FR-5.7."""
    masuk_staf(client, "hendra@jeda.local", "jeda-pemeriksa-2026")
    kid = client.get("/api/kelola/kasus").json()[-1]["id"]
    assert client.post(f"/api/kelola/kasus/{kid}/status", json={"status": "diarsipkan"}).status_code == 422
    assert client.post(f"/api/kelola/kasus/{kid}/status", json={"status": "diarsipkan", "catatan": "Rujukan kedaluwarsa."}).json()["status"] == "diarsipkan"
    masuk_rafi(client)
    assert all(k["id"] != kid for k in client.get("/api/kasus").json())
    assert client.put("/api/sesi", json={"id": _id(), "kasus_id": kid, "mode": "latihan"}).status_code == 404
    masuk_staf(client, "hendra@jeda.local", "jeda-pemeriksa-2026")
    client.post(f"/api/kelola/kasus/{kid}/status", json={"status": "terbit"})


def test_ruang_pembanding_tidak_melihat_latihan(client):
    """FR-6.3."""
    masuk_staf(client, "sari@jeda.local", "jeda-fasilitator-2026")
    pemb = next(r for r in client.get("/api/ruang").json() if r["pembanding"])
    client.post("/api/keluar")
    client.post("/api/masuk/ruang", json={"kode": pemb["kode"], "nama_samaran": "Pembanding"})
    client.post("/api/persetujuan", json={"setuju": True, "di_bawah_18": False})
    prof = client.get("/api/saya").json()["profil"]
    assert prof["latihan_terkunci"] is True
    k = client.get("/api/kasus").json()[0]
    assert client.put("/api/sesi", json={"id": _id(), "kasus_id": k["id"], "mode": "latihan"}).json()["error"]["code"] == "ruang_pembanding"
    # FR-6.4: tes akhir di luar jendela ditolak.
    assert client.get("/api/tes/akhir").json()["error"]["code"] == "tes_ditutup"


def test_kode_ruang_baru_unik_dan_acak(client):
    masuk_staf(client, "sari@jeda.local", "jeda-fasilitator-2026")
    r = client.post("/api/ruang", json={"nama": "Ruang Uji Kode"}).json()
    assert len(r["kode"].replace("-", "")) >= 9
    r2 = client.post(f"/api/ruang/{r['id']}/kode-baru").json()
    assert r2["kode"] != r["kode"]
    client.post("/api/keluar")
    assert client.post("/api/masuk/ruang", json={"kode": r["kode"], "nama_samaran": "Lama"}).status_code == 404


def test_audit_mencatat_dan_tidak_bisa_diubah(client):
    masuk_staf(client, "admin@jeda.local", "jeda-admin-2026")
    log = client.get("/api/admin/audit").json()
    aksi = {a["aksi"] for a in log}
    assert {"masuk", "telaah_terbit", "ekspor_anonim"} <= aksi
    for m in ("put", "patch", "delete"):
        assert getattr(client, m)(f"/api/admin/audit/{log[0]['id']}").status_code in (404, 405)


def test_hapus_data_pribadi(client):
    r = client.post("/api/masuk/ruang", json={"kode": "JD-07-BKL", "nama_samaran": "Akan Dihapus"})
    kode = r.json()["kode_pribadi"]
    client.post("/api/persetujuan", json={"setuju": True, "di_bawah_18": True})
    assert client.delete("/api/saya").status_code == 200
    assert client.post("/api/masuk/kode", json={"kode_pribadi": kode}).status_code == 401


def test_fungsi_murni():
    assert hitung_kelengkapan("a", "b", "2026-01-01", "c") == 4
    assert hitung_kelengkapan("a", "", None, "c") == 2
    assert skor_sus([5, 1] * 5) == 100.0
    assert skor_sus([3] * 10) == 50.0
