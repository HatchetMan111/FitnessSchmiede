from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Program
from app.plan_generator import generate_program
from app.schemas import ProgramCreate, ProgramOut, ProgramSessionOut

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.post("", response_model=ProgramOut)
def create_program(payload: ProgramCreate, db: Session = Depends(get_db)):
    if payload.focus not in ("bodyweight", "equipment", "mixed"):
        raise HTTPException(400, "focus muss 'bodyweight', 'equipment' oder 'mixed' sein")

    # Bisherige aktive Programme archivieren, damit das Dashboard immer
    # eindeutig das neue Programm als aktuelles findet.
    db.query(Program).filter(Program.status == "active").update({Program.status: "archived"})

    program = generate_program(
        db,
        name=payload.name,
        goal=payload.goal,
        focus=payload.focus,
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
