"""
Regelbasierter Generator für mehrwöchige Trainingsprogramme.

Läuft komplett offline, ohne KI-Anbindung. Die optionale KI-Anbindung
(siehe app/ai/) kann später als zusätzliche Schicht Vorschläge dieses
Generators kommentieren oder anpassen - der Generator selbst bleibt aber
die verlässliche Basis, die immer funktioniert.

Kernideen:
- Zirkel-/HIIT-Einheiten (Bodyweight) sind zeitbasiert (duration_seconds
  pro Übung) -> Frontend zeigt einen Countdown-Timer.
- Kraft-Einheiten (Geräte/Gewichte) sind satz-/wiederholungsbasiert
  (sets x reps) -> Frontend zeigt einen Satz-Zähler mit Pausen-Timer.
- Jede 4. Woche ist eine Deload-Woche (reduziertes Volumen zur Erholung).
"""
import random
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Exercise, Program, ProgramSession, SessionExercise

# Welche Dataset-Kategorien pro Einheitentyp gezogen werden.
SESSION_TEMPLATES = {
    "bodyweight": [
        ("Ganzkörper-Zirkel", ["chest", "back", "upper legs", "waist", "shoulders"], "time"),
        ("Unterkörper & Core", ["upper legs", "lower legs", "waist"], "time"),
        ("Oberkörper & Cardio", ["chest", "back", "shoulders", "upper arms", "cardio"], "time"),
    ],
    "equipment": [
        ("Push: Brust, Schulter, Trizeps", ["chest", "shoulders", "upper arms"], "reps"),
        ("Pull: Rücken, Bizeps", ["back", "upper arms"], "reps"),
        ("Beine", ["upper legs", "lower legs"], "reps"),
        ("Ganzkörper Kraft", ["chest", "back", "upper legs", "shoulders", "waist"], "reps"),
    ],
    "mixed": [
        ("Ganzkörper HIIT", ["chest", "back", "upper legs", "waist", "shoulders"], "time"),
        ("Kraft Oberkörper", ["chest", "back", "shoulders", "upper arms"], "reps"),
        ("Kraft Unterkörper", ["upper legs", "lower legs"], "reps"),
        ("Cardio & Core", ["cardio", "waist"], "time"),
    ],
}

EXERCISES_PER_SESSION = 6
DELOAD_EVERY_N_WEEKS = 4


def _equipment_filter(focus: str, style: str):
    """Body-weight-only für time-Einheiten; bei reps-Einheiten Geräte/Gewichte."""
    if focus == "bodyweight" or style == "time":
        return Exercise.equipment == "body weight"
    return Exercise.equipment != "body weight"


def _progression(week_number: int) -> tuple[float, bool]:
    """Gibt (Steigerungsfaktor 0..1, ist_deload) für eine gegebene Woche zurück."""
    is_deload = week_number % DELOAD_EVERY_N_WEEKS == 0
    position_in_block = (week_number - 1) % DELOAD_EVERY_N_WEEKS
    factor = position_in_block / (DELOAD_EVERY_N_WEEKS - 1)
    return factor, is_deload


def _pick_exercises(db: Session, categories: list[str], focus: str, style: str, exclude_ids: set[str]):
    query = db.query(Exercise).filter(
        Exercise.category.in_(categories), _equipment_filter(focus, style)
    )
    if exclude_ids:
        query = query.filter(~Exercise.id.in_(exclude_ids))
    pool = query.all()
    if len(pool) < EXERCISES_PER_SESSION:
        # Falls der Pool zu klein ist (z.B. wenige Bodyweight-Cardio-Übungen),
        # Ausschluss aufweichen statt eine leere Einheit zu erzeugen.
        pool = db.query(Exercise).filter(
            Exercise.category.in_(categories), _equipment_filter(focus, style)
        ).all()
    return random.sample(pool, k=min(EXERCISES_PER_SESSION, len(pool)))


def generate_program(
    db: Session,
    name: str,
    goal: str,
    focus: str,
    duration_weeks: int,
    days_per_week: int,
    start_date: datetime | None = None,
) -> Program:
    if focus not in SESSION_TEMPLATES:
        raise ValueError("focus muss 'bodyweight', 'equipment' oder 'mixed' sein")

    start_date = start_date or datetime.utcnow()
    templates = SESSION_TEMPLATES[focus]

    program = Program(
        name=name,
        goal=goal,
        focus=focus,
        duration_weeks=duration_weeks,
        days_per_week=days_per_week,
        start_date=start_date,
        status="active",
    )
    db.add(program)
    db.flush()  # program.id verfügbar machen

    for week in range(1, duration_weeks + 1):
        progress_factor, is_deload = _progression(week)
        recently_used: set[str] = set()

        for day in range(1, days_per_week + 1):
            session_type, categories, style = templates[(day - 1) % len(templates)]

            session = ProgramSession(
                program_id=program.id,
                week_number=week,
                day_number=day,
                session_type=session_type,
                planned_date=start_date + timedelta(weeks=week - 1, days=day - 1),
            )
            db.add(session)
            db.flush()

            exercises = _pick_exercises(db, categories, focus, style, recently_used)
            recently_used.update(e.id for e in exercises)

            for idx, exercise in enumerate(exercises):
                sets, reps, duration_seconds, rest_seconds = _dose(
                    style, progress_factor, is_deload
                )
                db.add(
                    SessionExercise(
                        session_id=session.id,
                        exercise_id=exercise.id,
                        order_index=idx,
                        sets=sets,
                        reps=reps,
                        duration_seconds=duration_seconds,
                        rest_seconds=rest_seconds,
                    )
                )

    db.commit()
    db.refresh(program)
    return program


def _dose(style: str, progress_factor: float, is_deload: bool):
    """Berechnet Sätze/Wiederholungen bzw. Arbeits-/Pausenzeiten für die
    gegebene Trainingswoche. Deload-Wochen reduzieren das Volumen um ~30%."""
    deload_mult = 0.7 if is_deload else 1.0

    if style == "time":
        work_seconds = round((30 + 20 * progress_factor) * deload_mult)  # 30s -> 50s
        rest_seconds = round(25 - 5 * progress_factor)  # 25s -> 20s zwischen Übungen
        return 3, None, work_seconds, rest_seconds

    # style == "reps"
    reps = round((8 + 4 * progress_factor) * deload_mult)  # 8 -> 12 Wiederholungen
    sets = 3 if is_deload else 4
    rest_seconds = 90
    return sets, reps, None, rest_seconds
