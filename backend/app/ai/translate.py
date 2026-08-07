"""
Übersetzt die englischen Übungsanleitungen einmalig ins Deutsche.

Läuft als Hintergrund-Job (siehe routers/settings.py), sobald mindestens
ein KI-Anbieter konfiguriert ist - auch der kostenlose lokale Ollama reicht.
Bereits übersetzte Übungen (translated_at gesetzt) werden übersprungen,
der Job kann also gefahrlos mehrfach laufen bzw. fortgesetzt werden.
"""
import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.ai.factory import build_adapter
from app.models import AIProvider, Exercise

SYSTEM_PROMPT = (
    "Du übersetzt Fitness-Übungsanleitungen aus dem Englischen ins Deutsche. "
    "Gib ausschließlich die deutsche Übersetzung zurück, ohne Anmerkungen, "
    "in klarer Imperativ-Form (z.B. 'Lege dich...', 'Ziehe...')."
)


async def translate_all_exercises(db: Session, provider: AIProvider, batch_size: int = 20) -> int:
    adapter = build_adapter(provider)
    todo = db.query(Exercise).filter(Exercise.translated_at.is_(None)).limit(batch_size).all()

    translated_count = 0
    for exercise in todo:
        de_text = await adapter.chat(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=exercise.instructions_en,
            model=provider.default_model,
        )
        exercise.instructions_de = de_text.strip()

        # Schritte grob am Satzende trennen, damit die Schritt-für-Schritt-
        # Ansicht in der App auch für die deutsche Fassung funktioniert.
        steps = [s.strip() for s in de_text.replace("\n", " ").split(". ") if s.strip()]
        exercise.instruction_steps_de = json.dumps(steps, ensure_ascii=False)
        exercise.translated_at = datetime.utcnow()
        translated_count += 1

    db.commit()
    return translated_count


def count_untranslated(db: Session) -> int:
    return db.query(Exercise).filter(Exercise.translated_at.is_(None)).count()
