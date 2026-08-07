from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Exercise
from app.schemas import ExerciseOut

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    category: str | None = None,
    equipment: str | None = None,
    search: str | None = Query(None, description="Freitextsuche im Übungsnamen"),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(Exercise)
    if category:
        query = query.filter(Exercise.category == category)
    if equipment:
        query = query.filter(Exercise.equipment == equipment)
    if search:
        query = query.filter(Exercise.name.ilike(f"%{search}%"))
    return query.order_by(Exercise.name).offset(offset).limit(limit).all()


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise(exercise_id: str, db: Session = Depends(get_db)):
    return db.get(Exercise, exercise_id)


@router.get("/meta/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Exercise.category).distinct().order_by(Exercise.category).all()
    return [r[0] for r in rows]
