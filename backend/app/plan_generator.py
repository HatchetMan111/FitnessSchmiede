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
import json
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

# Kuratierte Geräte-Gruppen, gemappt auf die tatsächlichen Equipment-Werte
# im Datensatz. Deckt 1317 der 1324 Übungen ab - die restlichen 7 hängen an
# Einzelgeräten (Skierg, Stepmill etc.) mit je nur 1 Übung und lohnen keine
# eigene Auswahl. "body weight" ist immer inklusive, keine eigene Auswahlgruppe.
EQUIPMENT_GROUPS = {
    "dumbbell": {"label": "Kurzhanteln", "values": ["dumbbell"], "count": 294},
    "barbell": {
        "label": "Langhantel",
        "values": ["barbell", "ez barbell", "olympic barbell", "trap bar"],
        "count": 180,
    },
    "cable": {"label": "Kabelzug", "values": ["cable"], "count": 157},
    "machine": {
        "label": "Kraftstation / Maschinen",
        "values": ["leverage machine", "smith machine", "sled machine", "assisted"],
        "count": 159,
    },
    "band": {"label": "Widerstandsband", "values": ["band", "resistance band"], "count": 61},
    "kettlebell": {"label": "Kettlebell", "values": ["kettlebell"], "count": 41},
    "weighted": {"label": "Zusatzgewicht (Weste/Gürtel)", "values": ["weighted"], "count": 36},
    "stability_ball": {
        "label": "Gymnastik-/Bosu-Ball",
        "values": ["stability ball", "bosu ball"],
        "count": 31,
    },
    "medicine_ball": {"label": "Medizinball", "values": ["medicine ball"], "count": 13},
    "rope": {"label": "Springseil / Battle Rope", "values": ["rope"], "count": 10},
    "roller": {"label": "Faszien-/Ab-Roller", "values": ["roller", "wheel roller"], "count": 10},
}

# Startwerte und Obergrenzen pro Fitness-Level - Anfänger starten spürbar
# leichter (kürzere Arbeitszeit, mehr Pause, weniger Übungen) und die Spanne
# bis zur Obergrenze ist enger, damit die Steigerung sanfter verläuft.
LEVEL_CONFIG = {
    "beginner": {
        "label": "Einsteiger",
        "exercises_per_session": 4,
        "time_work": (15, 28),
        "time_rest": (35, 28),
        "time_sets": 2,
        "reps": (6, 8),
        "reps_sets": (2, 3),
        "reps_rest": 100,
        "progression_pace": 0.6,  # erreicht die Obergrenze langsamer
    },
    "intermediate": {
        "label": "Fortgeschritten",
        "exercises_per_session": 6,
        "time_work": (30, 50),
        "time_rest": (25, 20),
        "time_sets": 3,
        "reps": (8, 12),
        "reps_sets": (3, 4),
        "reps_rest": 90,
        "progression_pace": 1.0,
    },
    "advanced": {
        "label": "Erfahren",
        "exercises_per_session": 7,
        "time_work": (40, 65),
        "time_rest": (20, 12),
        "time_sets": 3,
        "reps": (10, 15),
        "reps_sets": (4, 5),
        "reps_rest": 75,
        "progression_pace": 1.2,  # nutzt die Spanne schneller aus
    },
}

DELOAD_EVERY_N_WEEKS = 4


def _resolve_equipment_values(equipment_groups: list[str]) -> list[str]:
    values: list[str] = []
    for key in equipment_groups:
        group = EQUIPMENT_GROUPS.get(key)
        if group:
            values.extend(group["values"])
    return values


def _day_offsets(days_per_week: int) -> list[int]:
    """Verteilt die Trainingstage gleichmäßig über eine 7-Tage-Woche statt
    sie direkt hintereinander zu legen (z.B. Mo/Mi/Sa statt Mo/Di/Mi bei 3
    Tagen) - wichtig für Erholung zwischen Krafteinheiten."""
    if days_per_week >= 7:
        return list(range(7))
    offsets: list[int] = []
    for i in range(days_per_week):
        offset = round(i * 7 / days_per_week)
        while offset in offsets:
            offset += 1
        offsets.append(min(offset, 6))
    return offsets


def _equipment_filter(focus: str, style: str, allowed_equipment: list[str]):
    """Body-weight-only für time-Einheiten; bei reps-Einheiten nur die vom
    Nutzer ausgewählten Geräte. Ohne Auswahl: Fallback auf "alles außer
    Körpergewicht", statt eine leere Übungsauswahl zu riskieren."""
    if focus == "bodyweight" or style == "time":
        return Exercise.equipment == "body weight"
    if allowed_equipment:
        return Exercise.equipment.in_(allowed_equipment)
    return Exercise.equipment != "body weight"


def _progression(week_number: int) -> tuple[float, bool]:
    """Gibt (Steigerungsfaktor 0..1, ist_deload) für eine gegebene Woche zurück."""
    is_deload = week_number % DELOAD_EVERY_N_WEEKS == 0
    position_in_block = (week_number - 1) % DELOAD_EVERY_N_WEEKS
    factor = position_in_block / (DELOAD_EVERY_N_WEEKS - 1)
    return factor, is_deload


def _pick_exercises(
    db: Session,
    categories: list[str],
    focus: str,
    style: str,
    exclude_ids: set[str],
    allowed_equipment: list[str],
    exercises_per_session: int,
):
    equip_filter = _equipment_filter(focus, style, allowed_equipment)
    query = db.query(Exercise).filter(Exercise.category.in_(categories), equip_filter)
    if exclude_ids:
        query = query.filter(~Exercise.id.in_(exclude_ids))
    pool = query.all()
    if len(pool) < exercises_per_session:
        # Falls der Pool zu klein ist (z.B. wenige Bodyweight-Cardio-Übungen
        # oder eine sehr enge Geräte-Auswahl), Ausschluss aufweichen statt
        # eine leere Einheit zu erzeugen.
        pool = db.query(Exercise).filter(Exercise.category.in_(categories), equip_filter).all()
    if not pool:
        # Selbst ohne Ausschluss nichts gefunden (z.B. "nur Medizinball" trifft
        # keine Bein-Übung) - Geräte-Filter für diese eine Einheit komplett
        # aufweichen, damit garantiert nie eine leere Session entsteht.
        pool = db.query(Exercise).filter(Exercise.category.in_(categories)).all()
    return random.sample(pool, k=min(exercises_per_session, len(pool)))


def generate_program(
    db: Session,
    name: str,
    goal: str,
    focus: str,
    duration_weeks: int,
    days_per_week: int,
    equipment: list[str] | None = None,
    fitness_level: str = "intermediate",
    start_date: datetime | None = None,
) -> Program:
    if focus not in SESSION_TEMPLATES:
        raise ValueError("focus muss 'bodyweight', 'equipment' oder 'mixed' sein")
    if fitness_level not in LEVEL_CONFIG:
        raise ValueError("fitness_level muss 'beginner', 'intermediate' oder 'advanced' sein")

    equipment = equipment or []
    allowed_equipment = _resolve_equipment_values(equipment)
    exercises_per_session = LEVEL_CONFIG[fitness_level]["exercises_per_session"]

    start_date = start_date or datetime.utcnow()
    templates = SESSION_TEMPLATES[focus]
    day_offsets = _day_offsets(days_per_week)

    program = Program(
        name=name,
        goal=goal,
        focus=focus,
        equipment=json.dumps(equipment, ensure_ascii=False),
        fitness_level=fitness_level,
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
                planned_date=start_date + timedelta(weeks=week - 1, days=day_offsets[day - 1]),
            )
            db.add(session)
            db.flush()

            exercises = _pick_exercises(
                db, categories, focus, style, recently_used, allowed_equipment, exercises_per_session
            )
            recently_used.update(e.id for e in exercises)

            for idx, exercise in enumerate(exercises):
                sets, reps, duration_seconds, rest_seconds = _dose(
                    style, progress_factor, is_deload, fitness_level
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


def _dose(style: str, progress_factor: float, is_deload: bool, fitness_level: str):
    """Berechnet Sätze/Wiederholungen bzw. Arbeits-/Pausenzeiten für die
    gegebene Trainingswoche, skaliert auf den Start-/Zielbereich des
    Fitness-Levels. Deload-Wochen reduzieren das Volumen zusätzlich um ~30%."""
    cfg = LEVEL_CONFIG[fitness_level]
    factor = min(progress_factor * cfg["progression_pace"], 1.0)
    deload_mult = 0.7 if is_deload else 1.0

    if style == "time":
        w0, w1 = cfg["time_work"]
        r0, r1 = cfg["time_rest"]
        work_seconds = round((w0 + (w1 - w0) * factor) * deload_mult)
        rest_seconds = round(r0 + (r1 - r0) * factor)
        return cfg["time_sets"], None, work_seconds, rest_seconds

    # style == "reps"
    reps0, reps1 = cfg["reps"]
    sets0, sets1 = cfg["reps_sets"]
    reps = round((reps0 + (reps1 - reps0) * factor) * deload_mult)
    sets = sets0 if is_deload else sets1
    return sets, reps, None, cfg["reps_rest"]
