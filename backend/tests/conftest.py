import os
import sys
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="jeda-test-")
os.environ["JEDA_DATA_DIR"] = _tmp
# JEDA_TEST_DATABASE_URL memungkinkan uji yang sama dijalankan di PostgreSQL kosong.
os.environ["DATABASE_URL"] = os.getenv("JEDA_TEST_DATABASE_URL") or f"sqlite:///{Path(_tmp, 'test.db').as_posix()}"
os.environ["JEDA_SEED_DEMO"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def _app():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client(_app):
    """Klien baru per uji, berbagi aplikasi dan basis data yang sama."""
    from app.security import masuk_limiter

    masuk_limiter.hits.clear()
    with TestClient(app) as c:
        yield c


def masuk_staf(c, surel, pw):
    r = c.post("/api/masuk/staf", json={"surel": surel, "kata_sandi": pw})
    assert r.status_code == 200, r.text
    return r.json()["profil"]


def masuk_rafi(c):
    r = c.post("/api/masuk/kode", json={"kode_pribadi": "RAFI-2026"})
    assert r.status_code == 200, r.text
    return r.json()["profil"]
