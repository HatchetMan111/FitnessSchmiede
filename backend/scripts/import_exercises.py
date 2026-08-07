"""
Importiert den Übungsdatensatz (hasaneyldrm/exercises-dataset) in die
FitnessSchmiede-Datenbank. Wird einmalig vom Install-Skript aufgerufen,
kann aber gefahrlos erneut laufen (bestehende Einträge werden aktualisiert,
keine Duplikate).

Erwartet, dass das Dataset-Repo bereits lokal liegt (siehe install.sh),
z.B. unter /opt/fitnessschmiede/data/exercises-dataset/, mit:
  data/exercises.json
  images/*.jpg
  videos/*.gif

Nur die englischen Anleitungen werden übernommen - die deutsche Übersetzung
läuft separat und bei Bedarf über app/ai/translate.py (siehe README).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal, init_db  # noqa: E402
from app.models import Exercise  # noqa: E402


def import_exercises(dataset_dir: Path) -> int:
    json_path = dataset_dir / "data" / "exercises.json"
    if not json_path.exists():
        raise FileNotFoundError(
            f"exercises.json nicht gefunden unter {json_path} - "
            "wurde das Dataset-Repo korrekt geklont?"
        )

    with open(json_path, encoding="utf-8") as f:
        records = json.load(f)

    init_db()
    db = SessionLocal()
    imported = 0
    try:
        for rec in records:
            exercise = db.get(Exercise, rec["id"])
            if exercise is None:
                exercise = Exercise(id=rec["id"])
                db.add(exercise)

            exercise.name = rec["name"]
            exercise.category = rec["category"]
            exercise.body_part = rec["body_part"]
            exercise.equipment = rec["equipment"]
            exercise.target = rec["target"]
            exercise.muscle_group = rec["muscle_group"]
            exercise.secondary_muscles = json.dumps(
                rec.get("secondary_muscles", []), ensure_ascii=False
            )
            exercise.instructions_en = rec["instructions"]["en"]
            exercise.instruction_steps_en = json.dumps(
                rec.get("instruction_steps", {}).get("en", []), ensure_ascii=False
            )
            # Pfade bleiben relativ zum Dataset-Ordner, das Backend mountet
            # diesen Ordner als statisches Verzeichnis (siehe app/main.py).
            exercise.image_path = rec["image"]
            exercise.gif_path = rec["gif_url"]
            exercise.media_id = rec["media_id"]
            exercise.attribution = rec["attribution"]

            imported += 1

        db.commit()
    finally:
        db.close()

    return imported


if __name__ == "__main__":
    dataset_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "/opt/fitnessschmiede/data/exercises-dataset"
    )
    count = import_exercises(dataset_path)
    print(f"{count} Übungen importiert aus {dataset_path}")
