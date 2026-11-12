from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Program, ProgramSession

router = APIRouter(prefix="/api/history", tags=["history"])


def _current_streak(sessions: list[ProgramSession]) -> int:
    """Zählt rückwärts ab der letzten bereits fälligen Einheit, wie viele
    davon in Folge erledigt wurden. Bricht bei der ersten verpassten ab -
    passt damit auch zu über die Woche verteilten Trainingstagen, statt
    Kalendertage vorauszusetzen."""
    now = datetime.utcnow()
    past_due = sorted(
        (s for s in sessions if s.planned_date and s.planned_date <= now),
        key=lambda s: s.planned_date,
    )
    streak = 0
    for s in reversed(past_due):
        if s.completed:
            streak += 1
        else:
            break
    return streak


@router.get("")
def get_history(db: Session = Depends(get_db)):
    all_sessions = (
        db.query(ProgramSession)
        .join(Program)
        .order_by(ProgramSession.week_number, ProgramSession.day_number)
        .all()
    )

    completed = [s for s in all_sessions if s.completed]
    total_completed = len(completed)

    active = db.query(Program).filter(Program.status == "active").order_by(Program.created_at.desc()).first()
    streak = _current_streak([s for s in all_sessions if s.program_id == active.id]) if active else 0

    this_week = None
    if active:
        elapsed_weeks = max((datetime.utcnow() - active.start_date).days // 7, 0)
        current_week_number = min(elapsed_weeks + 1, active.duration_weeks)
        week_sessions = [s for s in all_sessions if s.program_id == active.id and s.week_number == current_week_number]
        this_week = {
            "week_number": current_week_number,
            "completed": sum(1 for s in week_sessions if s.completed),
            "total": len(week_sessions),
        }

    recent = sorted(
        (s for s in completed if s.completed_at), key=lambda s: s.completed_at, reverse=True
    )[:10]

    return {
        "total_completed": total_completed,
        "current_streak": streak,
        "this_week": this_week,
        "recent_sessions": [
            {
                "id": s.id,
                "program_name": s.program.name,
                "session_type": s.session_type,
                "week_number": s.week_number,
                "day_number": s.day_number,
                "completed_at": s.completed_at,
                "exercise_count": len(s.exercises),
            }
            for s in recent
        ],
    }
