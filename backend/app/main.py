import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import exercises, nutrition, programs, sessions, settings

app = FastAPI(title="FitnessSchmiede", version="0.1.0")

app.include_router(exercises.router)
app.include_router(programs.router)
app.include_router(sessions.router)
app.include_router(settings.router)
app.include_router(nutrition.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Bilder/GIFs aus dem geklonten Übungs-Dataset direkt ausliefern
# (© Gym visual, Attribution bleibt pro Übung im Datensatz erhalten).
dataset_dir = Path(os.environ.get("DATASET_DIR", "/opt/fitnessschmiede/data/exercises-dataset"))
if dataset_dir.exists():
    app.mount("/media", StaticFiles(directory=str(dataset_dir)), name="media")

# Gebautes PWA-Frontend ausliefern, falls vorhanden (siehe install.sh).
frontend_dist = Path(os.environ.get("FRONTEND_DIST", "/opt/fitnessschmiede/frontend/dist"))
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
