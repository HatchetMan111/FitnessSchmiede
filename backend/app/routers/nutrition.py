from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.nutrition import ACTIVITY_LABELS, calculate_targets
from app.models import Program, UserProfile
from app.schemas import NutritionTargetsOut, ProfileIn, ProfileOut

router = APIRouter(prefix="/api", tags=["nutrition"])


@router.get("/profile", response_model=ProfileOut | None)
def get_profile(db: Session = Depends(get_db)):
    return db.get(UserProfile, 1)


@router.get("/nutrition/activity-levels")
def activity_levels():
    return ACTIVITY_LABELS


@router.post("/profile", response_model=ProfileOut)
def upsert_profile(payload: ProfileIn, db: Session = Depends(get_db)):
    profile = db.get(UserProfile, 1)
    if profile is None:
        profile = UserProfile(id=1)
        db.add(profile)
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/nutrition/targets", response_model=NutritionTargetsOut)
def nutrition_targets(db: Session = Depends(get_db)):
    profile = db.get(UserProfile, 1)
    if not profile:
        raise HTTPException(400, "Noch kein Profil hinterlegt")

    active = db.query(Program).filter(Program.status == "active").order_by(Program.created_at.desc()).first()
    goal = active.goal if active else "Ausdauer & Fitness"

    return calculate_targets(profile, goal)
