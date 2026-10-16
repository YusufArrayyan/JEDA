import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("JEDA_DATA_DIR", BASE_DIR / "var"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(DATA_DIR / 'jeda.db').as_posix()}")
# Render/Heroku memberi "postgres://" atau "postgresql://"; SQLAlchemy perlu nama driver.
for _p in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(_p):
        DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len(_p):]
        break

SESSION_DAYS = float(os.getenv("JEDA_SESSION_DAYS", "30"))
COOKIE_SECURE = os.getenv("JEDA_COOKIE_SECURE", "0") == "1"
CORS_ORIGINS = [o for o in os.getenv("JEDA_CORS_ORIGINS", "http://localhost:5173").split(",") if o]

# FR-7.6: pada lingkungan uji/prototipe, dasbor memberi catatan bahwa angka hanyalah ilustrasi.
MODE_UJI = os.getenv("JEDA_MODE_UJI", "1") == "1"
# Isi data contoh (peserta sintetis) saat basis data kosong.
SEED_DEMO = os.getenv("JEDA_SEED_DEMO", "1") == "1"

# Aturan agregat (NFR-8, FR-7.2): kelompok kurang dari K_MIN orang tidak ditampilkan.
K_MIN = 5
CEK_MAKS_KARAKTER = 1000
RETENSI_HARI = int(os.getenv("JEDA_RETENSI_HARI", "90"))
# Tanggal laporan pilot selesai; data perseorangan dianonimkan RETENSI_HARI setelahnya (Bab 11).
LAPORAN_PILOT_SELESAI = os.getenv("JEDA_LAPORAN_PILOT_SELESAI", "2027-01-10")
BATAS_USULAN_PER_MINGGU = 5
