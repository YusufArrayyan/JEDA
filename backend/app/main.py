"""Titik masuk FastAPI. Jalankan: uvicorn app.main:app --reload"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api_konten import router as konten_router
from .api_peserta import router as peserta_router
from .api_staf import router as staf_router
from .bootstrap import jalankan_retensi, seed
from .config import CORS_ORIGINS
from .security import api_limiter


class JsonFormatter(logging.Formatter):
    def format(self, record):
        base = {"t": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"), "lvl": record.levelname, "log": record.name, "msg": record.getMessage()}
        for k in ("path", "status", "ms", "method"):
            if hasattr(record, k):
                base[k] = getattr(record, k)
        if record.exc_info:
            base["exc"] = self.formatException(record.exc_info)
        return json.dumps(base, ensure_ascii=False)


_h = logging.StreamHandler()
_h.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_h], force=True)
log = logging.getLogger("jeda.http")


async def _tugas_harian():
    """Tugas terjadwal (Bab 6.4, FR-9.6): retensi dan pembersihan sesi setiap 24 jam."""
    while True:
        try:
            await asyncio.to_thread(jalankan_retensi)
        except Exception:  # noqa: BLE001
            log.exception("retensi gagal")
        await asyncio.sleep(24 * 3600)


@asynccontextmanager
async def lifespan(_: FastAPI):
    seed()
    task = asyncio.create_task(_tugas_harian())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="JEDA API", version="1.0.0", description="Pelatihan literasi verifikasi dengan Tombol JEDA dan Jejak Verifikasi.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"


@app.middleware("http")
async def observe(request: Request, call_next):
    t0 = time.perf_counter()
    if request.url.path.startswith("/api/"):
        try:
            api_limiter.check(request.client.host if request.client else "?")
        except Exception as e:  # noqa: BLE001
            return JSONResponse(status_code=429, content={"error": e.detail})
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000, 1)
    if request.url.path.startswith("/api/"):
        log.info("permintaan", extra={"method": request.method, "path": request.url.path, "status": response.status_code, "ms": ms})
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not request.url.path.startswith(("/docs", "/redoc", "/openapi")):
        response.headers["Content-Security-Policy"] = CSP
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "galat", "message": str(exc.detail), "hint": ""}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


FIELD_LABEL = {
    "kode": "Kode ruang",
    "nama_samaran": "Nama samaran",
    "surel": "Surel",
    "kata_sandi": "Kata sandi",
    "kode_pribadi": "Kode pribadi",
    "klaim": "Klaim",
    "judul": "Judul",
}


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    parts = []
    for e in exc.errors()[:4]:
        loc = ".".join(str(x) for x in e.get("loc", [])[1:])
        t = e.get("type", "")
        label = FIELD_LABEL.get(loc, loc) or "Isian"
        if t == "string_too_short":
            parts.append(f"{label} terlalu pendek")
        elif t == "string_too_long":
            parts.append(f"{label} terlalu panjang")
        elif t == "missing":
            parts.append(f"{label} belum diisi")
        else:
            parts.append(f"{label} tidak sesuai format")
    return JSONResponse(status_code=422, content={"error": {"code": "masukan_tidak_sah", "message": "; ".join(parts) + ".", "hint": "Perbaiki isian yang disebut, lalu kirim lagi."}})


app.include_router(peserta_router)
app.include_router(konten_router)
app.include_router(staf_router)

# Sajikan antarmuka hasil build (frontend/dist) bila ada, untuk penyebaran satu wadah.
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": {"code": "tidak_ditemukan", "message": "Alamat API tidak ditemukan.", "hint": "Lihat /docs untuk daftar alamat."}})
        f = (DIST / path).resolve()
        if path and f.is_file() and DIST.resolve() in f.parents:
            headers = {"Cache-Control": "no-cache"} if f.name in ("sw.js", "manifest.webmanifest") else {}
            return FileResponse(f, headers=headers)
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})
