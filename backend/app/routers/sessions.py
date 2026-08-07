from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ProgramSession, WorkoutLog
from app.schemas import ProgramSessionOut, WorkoutLogCreate

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("/{session_id}", response_model=ProgramSessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(ProgramSession, session_id)
    if not session:
        raise HTTPException(404, "Einheit nicht gefunden")
    return session


@router.post("/{session_id}/complete")
def complete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(ProgramSession, session_id)
    if not session:
        raise HTTPException(404, "Einheit nicht gefunden")
    session.completed = True
    session.completed_at = datetime.utcnow()
    db.commit()
    return {"status": "ok"}


@router.post("/logs")
def log_workout(payload: WorkoutLogCreate, db: Session = Depends(get_db)):
    log = WorkoutLog(**payload.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id}
