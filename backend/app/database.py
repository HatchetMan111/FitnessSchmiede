"""
Datenbank-Setup für FitnessSchmiede.

Nutzt SQLite als einzelne Datei - passt zum Single-User-LXC-Betrieb ohne
separaten Datenbank-Prozess. Der Pfad kann per Umgebungsvariable DB_PATH
überschrieben werden (Standard: /opt/fitnessschmiede/data/fitnessschmiede.db).
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = os.environ.get(
    "DB_PATH", str(Path(__file__).resolve().parents[1] / "data" / "fitnessschmiede.db")
)
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    # Modelle importieren, damit sie bei Base registriert sind, bevor
    # die Tabellen erstellt werden.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
