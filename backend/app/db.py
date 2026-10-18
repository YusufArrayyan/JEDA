import re
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL, DB_SCHEMA

_is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30} if _is_sqlite else {},
    pool_pre_ping=True,
)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

elif DB_SCHEMA:
    # Skema sendiri agar JEDA bisa menumpang di satu basis data PostgreSQL bersama aplikasi lain.
    if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", DB_SCHEMA):
        raise ValueError("JEDA_DB_SCHEMA hanya boleh huruf kecil, angka, dan garis bawah.")

    @event.listens_for(engine, "connect")
    def _pg_schema(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"')
        cur.execute(f'SET search_path TO "{DB_SCHEMA}"')
        cur.close()
        dbapi_conn.commit()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
