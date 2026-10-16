"""Berkas cetak A5 (FR-5.6, FR-8.4) dengan ReportLab. Setiap halaman bertanda SIMULASI."""

from __future__ import annotations

import io

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A5
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from . import content

W, H = A5
M = 36
INK = HexColor("#1A1A1A")
SLATE = HexColor("#5D5B54")
BRAND = HexColor("#1F56D0")
HAIR = HexColor("#E5E3DF")
TINT = {"J": HexColor("#DCECFA"), "E": HexColor("#D9F3E1"), "D": HexColor("#FFE8D4"), "A": HexColor("#E6E0F5")}


class _Kanvas:
    def __init__(self, judul_dok: str):
        self.buf = io.BytesIO()
        self.c = canvas.Canvas(self.buf, pagesize=A5)
        self.c.setTitle(judul_dok)
        self.c.setAuthor("JEDA")
        self.y = H - M
        self._halaman_baru()

    def _halaman_baru(self):
        c = self.c
        c.saveState()
        c.setFillColor(HexColor("#C92A2A"))
        c.setFillAlpha(0.08)
        c.setFont("Helvetica-Bold", 64)
        c.translate(W / 2, H / 2)
        c.rotate(35)
        c.drawCentredString(0, -20, "SIMULASI")
        c.restoreState()
        c.setFillColor(BRAND)
        c.roundRect(M, H - M - 18, 18, 18, 4, fill=1, stroke=0)
        c.setFillColor(HexColor("#FFFFFF"))
        c.rect(M + 5.5, H - M - 13.5, 2.5, 9, fill=1, stroke=0)
        c.rect(M + 10, H - M - 13.5, 2.5, 9, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(M + 24, H - M - 13, "JEDA")
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(HexColor("#C92A2A"))
        c.drawRightString(W - M, H - M - 12, "SIMULASI · materi latihan")
        c.setFillColor(SLATE)
        c.setFont("Helvetica", 7)
        c.drawString(M, M - 14, "Jelajah Sumber · Evaluasi Bukti · Deteksi Manipulasi · Ambil Sikap")
        self.y = H - M - 40

    def baru(self):
        self.c.showPage()
        self._halaman_baru()

    def cek_ruang(self, tinggi: float):
        if self.y - tinggi < M + 6:
            self.baru()

    def teks(self, s: str, size=10, bold=False, color=INK, gap=4, indent=0):
        font = "Helvetica-Bold" if bold else "Helvetica"
        lines = simpleSplit(s, font, size, W - 2 * M - indent)
        lh = size * 1.35
        self.cek_ruang(lh * len(lines) + gap)
        self.c.setFont(font, size)
        self.c.setFillColor(color)
        for ln in lines:
            self.y -= lh
            self.c.drawString(M + indent, self.y, ln)
        self.y -= gap

    def kotak(self, huruf: str, judul: str, isi: list[str]):
        lines = []
        for s in isi:
            lines += simpleSplit(s, "Helvetica", 9, W - 2 * M - 34)
        h = 30 + len(lines) * 12.5
        self.cek_ruang(h + 8)
        c = self.c
        c.setFillColor(TINT.get(huruf, HAIR))
        c.roundRect(M, self.y - h, W - 2 * M, h, 8, fill=1, stroke=0)
        c.setFillColor(HexColor("#FFFFFF"))
        c.roundRect(M + 10, self.y - 24, 16, 16, 4, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(M + 18, self.y - 19.5, huruf)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(M + 34, self.y - 19.5, judul)
        c.setFont("Helvetica", 9)
        yy = self.y - 34
        for ln in lines:
            c.drawString(M + 34, yy, ln)
            yy -= 12.5
        self.y -= h + 8

    def garis(self):
        self.y -= 4
        self.c.setStrokeColor(HAIR)
        self.c.line(M, self.y, W - M, self.y)
        self.y -= 8

    def selesai(self) -> bytes:
        self.c.save()
        return self.buf.getvalue()


def kartu_prebunking(judul: str, teknik: str, klaim: str, pesan: str, bukti: str = "") -> bytes:
    k = _Kanvas(f"Kartu JEDA: {judul}")
    k.teks("KARTU PREBUNKING", 8, True, BRAND)
    k.teks(judul, 18, True, gap=8)
    k.teks(f"Teknik: {teknik}", 9, True, SLATE, gap=10)
    k.teks("Klaim yang beredar", 8, True, SLATE)
    k.teks(klaim, 10, gap=10)
    if bukti:
        k.teks("Bukti", 8, True, SLATE)
        k.teks(bukti, 10, gap=10)
    k.garis()
    k.teks("Pesan untuk temanmu", 8, True, SLATE)
    k.teks(pesan, 13, True, gap=10)
    k.teks("Sebelum meneruskan: apa buktinya, siapa yang diuntungkan, apa akibatnya jika salah?", 9, False, SLATE)
    return k.selesai()


def set_kartu_luring(kasus: list[dict], nama_teknik: dict[str, str]) -> bytes:
    """FR-8.4: satu set kartu dapat dipakai tanpa gawai."""
    k = _Kanvas("Set kartu luring JEDA")
    k.teks("SET KARTU LURING", 8, True, BRAND)
    k.teks("Latihan JEDA tanpa gawai", 18, True, gap=8)
    k.teks("Pakai satu kartu kasus per kelompok. Bahas empat tahap bersama, lalu jawab tiga pertanyaan Tombol JEDA dan pilih satu tindakan. Fasilitator mencatat rekapnya di aplikasi.", 10, gap=10)
    k.kotak("J", "Jelajah Sumber", ["Siapa pembuatnya, kapan pertama kali diunggah, dan adakah kanal resmi yang bisa dibuka sendiri?"])
    k.kotak("E", "Evaluasi Bukti", ["Cari klaim di sumber lain. Catat satu sumber primer dan satu pembanding independen."])
    k.kotak("D", "Deteksi Manipulasi", ["Kenali tekniknya: " + ", ".join(nama_teknik.values()) + "."])
    k.kotak("A", "Ambil Sikap", ["Jawab tiga pertanyaan Tombol JEDA, lalu pilih satu tindakan."])
    k.baru()
    k.teks("TOMBOL JEDA", 8, True, BRAND)
    k.teks("Tiga pertanyaan sebelum berbagi", 16, True, gap=8)
    for i, (q, label) in enumerate((("q_bukti", "Apa buktinya?"), ("q_untung", "Siapa yang diuntungkan?"), ("q_akibat", "Apa akibatnya jika informasi ini salah?")), 1):
        k.teks(f"{i}. {label}", 11, True, gap=2)
        k.teks("Contoh: " + "; ".join(v for _, v in content.JEDA_OPSI[q]), 9, color=SLATE, gap=8, indent=12)
    k.garis()
    k.teks("Pilih satu tindakan", 11, True, gap=4)
    for _, label, desk in content.JEDA_OPSI["tindakan"]:
        k.teks(f"[  ] {label}", 10, True, gap=1)
        k.teks(desk, 9, color=SLATE, gap=6, indent=18)
    k.teks("JEDA tidak memberi vonis benar atau salah. Kamu yang menyusun buktinya.", 9, True, SLATE)
    for ks in kasus:
        k.baru()
        k.teks("KARTU KASUS · Kasus lokal Bengkulu", 8, True, BRAND)
        k.teks(ks["judul"], 16, True, gap=8)
        k.teks(ks["klaim"], 10.5, gap=10)
        k.teks("Konteks: " + ks["konten"].get("konteks", ""), 9, color=SLATE, gap=10)
        k.teks("Kata kunci untuk dicari: " + ", ".join(ks["konten"].get("kata_kunci", [])), 9, color=SLATE, gap=10)
        k.garis()
        k.teks("Lembar fasilitator (lipat bagian ini)", 8, True, SLATE)
        k.teks("Petunjuk asal-usul: " + "; ".join(p["teks"] for p in ks["konten"]["petunjuk"] if p["tepat"]), 9, gap=6)
        k.teks("Teknik: " + ", ".join(nama_teknik.get(t, t) for t in ks["teknik"]), 9, gap=6)
        k.teks("Pesan prebunking: " + ks["pesan_prebunking"], 9, True, gap=6)
    return k.selesai()
