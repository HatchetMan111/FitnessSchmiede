from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Program
from app.plan_generator import EQUIPMENT_GROUPS, LEVEL_CONFIG, generate_program
from app.schemas import ProgramCreate, ProgramOut, ProgramSessionOut

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.get("/meta/equipment-groups")
def equipment_groups():
    return {key: {"label": g["label"], "count": g["count"]} for key, g in EQUIPMENT_GROUPS.items()}


@router.get("/meta/fitness-levels")
def fitness_levels():
    return {key: cfg["label"] for key, cfg in LEVEL_CONFIG.items()}


@router.post("", response_model=ProgramOut)
def create_program(payload: ProgramCreate, db: Session = Depends(get_db)):
    if payload.focus not in ("bodyweight", "equipment", "mixed"):
        raise HTTPException(400, "focus muss 'bodyweight', 'equipment' oder 'mixed' sein")
    if payload.fitness_level not in LEVEL_CONFIG:
        raise HTTPException(400, "fitness_level muss 'beginner', 'intermediate' oder 'advanced' sein")

    # Bisherige aktive Programme archivieren, damit das Dashboard immer
    # eindeutig das neue Programm als aktuelles findet.
    db.query(Program).filter(Program.status == "active").update({Program.status: "archived"})

    program = generate_program(
        db,
        name=payload.name,
        goal=payload.goal,
        focus=payload.focus,
        equipment=payload.equipment,
        fitness_level=payload.fitness_level,
        session_minutes=payload.session_minutes,
        duration_weeks=payload.duration_weeks,
        days_per_week=payload.days_per_week,
    )
    return program


@router.get("", response_model=list[ProgramOut])
def list_programs(db: Session = Depends(get_db)):
    return db.query(Program).order_by(Program.created_at.desc()).all()


@router.get("/{program_id}/sessions", response_model=list[ProgramSessionOut])
def list_program_sessions(program_id: int, db: Session = Depends(get_db)):
    program = db.get(Program, program_id)
    if not program:
        raise HTTPException(404, "Programm nicht gefunden")
    return program.sessions
