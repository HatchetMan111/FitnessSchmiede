from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    equipment: str
    target: str
    instructions_en: str
    instructions_de: str | None
    image_path: str
    gif_path: str
    attribution: str


class SessionExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_index: int
    sets: int
    reps: int | None
    duration_seconds: int | None
    rest_seconds: int
    exercise: ExerciseOut


class ProgramSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    week_number: int
    day_number: int
    session_type: str
    planned_date: datetime | None
    completed: bool
    exercises: list[SessionExerciseOut]


class ProgramCreate(BaseModel):
    name: str
    goal: str
    focus: str  # "bodyweight" | "equipment" | "mixed"
    duration_weeks: int = 8
    days_per_week: int = 3


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    goal: str
    focus: str
    duration_weeks: int
    days_per_week: int
    start_date: datetime
    status: str


class WorkoutLogCreate(BaseModel):
    session_exercise_id: int
    actual_sets: int | None = None
    actual_reps: int | None = None
    actual_weight_kg: float | None = None
    actual_duration_seconds: int | None = None
    rpe: int | None = None
    notes: str | None = None


class AIProviderCreate(BaseModel):
    name: str
    provider_type: str  # "openai_compatible" | "anthropic_native"
    base_url: str
    api_key: str | None = None
    default_model: str
    is_default: bool = False


class AIProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    provider_type: str
    base_url: str
    default_model: str
    is_default: bool
    # api_key bewusst nicht in der Ausgabe, damit er nicht durchs Frontend
    # geloggt / in der Browser-Konsole sichtbar wird.
