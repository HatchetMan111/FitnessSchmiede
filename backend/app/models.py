"""
Datenmodell FitnessSchmiede.

Kernidee:
- `Exercise` wird einmalig beim Setup aus dem Übungs-Dataset importiert.
- `Program` ist ein festes mehrwöchiges Trainingsprogramm mit Progression.
- `ProgramSession` ist eine einzelne Trainingseinheit innerhalb des Programms
  (z.B. Woche 3, Tag 2, "Oberkörper Push").
- `SessionExercise` verknüpft Übungen mit einer Session inkl. Sätzen/Zeiten.
- `WorkoutLog` speichert, was tatsächlich absolviert wurde (für Fortschritt
  und künftige adaptive Anpassungen).
- `AIProvider` speichert optionale KI-Anbindungen (Ollama/ChatGPT/Claude/...).
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    # ID aus dem Original-Dataset wird übernommen (z.B. "0001")
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True)
    category: Mapped[str] = mapped_column(String, index=True)  # Körperbereich
    body_part: Mapped[str] = mapped_column(String, index=True)
    equipment: Mapped[str] = mapped_column(String, index=True)
    target: Mapped[str] = mapped_column(String, index=True)  # Hauptmuskel
    muscle_group: Mapped[str] = mapped_column(String)
    secondary_muscles: Mapped[str] = mapped_column(Text, default="[]")  # JSON-Liste

    instructions_en: Mapped[str] = mapped_column(Text)
    instructions_de: Mapped[str | None] = mapped_column(Text, nullable=True)
    instruction_steps_en: Mapped[str] = mapped_column(Text, default="[]")  # JSON-Liste
    instruction_steps_de: Mapped[str | None] = mapped_column(Text, nullable=True)
    translated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    image_path: Mapped[str] = mapped_column(String)  # relativer Pfad zu Thumbnail
    gif_path: Mapped[str] = mapped_column(String)  # relativer Pfad zu Animation
    media_id: Mapped[str] = mapped_column(String)
    attribution: Mapped[str] = mapped_column(String)


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String)
    goal: Mapped[str] = mapped_column(String)  # z.B. "Kraftaufbau", "Ausdauer", "Abnehmen"
    focus: Mapped[str] = mapped_column(String)  # "bodyweight" | "equipment" | "mixed"
    duration_weeks: Mapped[int] = mapped_column(Integer)
    days_per_week: Mapped[int] = mapped_column(Integer)
    start_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String, default="active")  # active|completed|draft
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["ProgramSession"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )


class ProgramSession(Base):
    __tablename__ = "program_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"))
    week_number: Mapped[int] = mapped_column(Integer)
    day_number: Mapped[int] = mapped_column(Integer)
    session_type: Mapped[str] = mapped_column(String)  # z.B. "Push", "Full-Body HIIT"
    planned_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    program: Mapped["Program"] = relationship(back_populates="sessions")
    exercises: Mapped[list["SessionExercise"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="SessionExercise.order_index"
    )


class SessionExercise(Base):
    __tablename__ = "session_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("program_sessions.id"))
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"))
    order_index: Mapped[int] = mapped_column(Integer)

    sets: Mapped[int] = mapped_column(Integer, default=3)
    reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)  # für Zeit-Übungen
    rest_seconds: Mapped[int] = mapped_column(Integer, default=60)

    session: Mapped["ProgramSession"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship()


class WorkoutLog(Base):
    __tablename__ = "workout_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_exercise_id: Mapped[int] = mapped_column(ForeignKey("session_exercises.id"))
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actual_sets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rpe: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-10
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String)  # frei wählbares Label
    # "openai_compatible" deckt Ollama, ChatGPT/OpenAI und OpenRouter ab
    # (alle sprechen dasselbe Anfrageformat) - "anthropic_native" für Claude direkt.
    provider_type: Mapped[str] = mapped_column(String)
    base_url: Mapped[str] = mapped_column(String)
    api_key: Mapped[str | None] = mapped_column(String, nullable=True)  # z.B. leer bei Ollama
    default_model: Mapped[str] = mapped_column(String)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


class UserProfile(Base):
    """Singleton (id=1) - eine Person pro Installation. Dient ausschließlich
    der Berechnung von Kalorien-/Makro-Richtwerten, kein Tracking-Verlauf."""

    __tablename__ = "user_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    weight_kg: Mapped[float] = mapped_column(Float)
    height_cm: Mapped[float] = mapped_column(Float)
    age: Mapped[int] = mapped_column(Integer)
    sex: Mapped[str] = mapped_column(String)  # "male" | "female" (für BMR-Formel)
    activity_level: Mapped[str] = mapped_column(String, default="moderate")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
