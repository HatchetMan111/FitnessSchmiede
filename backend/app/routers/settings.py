from types import SimpleNamespace

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.factory import PROVIDER_PRESETS
from app.ai.translate import count_untranslated, translate_all_exercises
from app.database import SessionLocal, get_db
from app.models import AIProvider
from app.schemas import AIProviderCreate, AIProviderOut

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/ai-provider-presets")
def get_provider_presets():
    return PROVIDER_PRESETS


@router.get("/ai-providers", response_model=list[AIProviderOut])
def list_providers(db: Session = Depends(get_db)):
    return db.query(AIProvider).all()


@router.post("/ai-providers", response_model=AIProviderOut)
def create_provider(payload: AIProviderCreate, db: Session = Depends(get_db)):
    if payload.is_default:
        db.query(AIProvider).update({AIProvider.is_default: False})
    provider = AIProvider(**payload.model_dump())
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.delete("/ai-providers/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.get(AIProvider, provider_id)
    if not provider:
        raise HTTPException(404, "Anbieter nicht gefunden")
    db.delete(provider)
    db.commit()
    return {"status": "ok"}


@router.get("/translation-status")
def translation_status(db: Session = Depends(get_db)):
    return {"untranslated": count_untranslated(db)}


@router.post("/translate-exercises")
async def trigger_translation(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    provider = db.query(AIProvider).filter(AIProvider.is_default.is_(True)).first()
    if not provider:
        raise HTTPException(
            400, "Kein Standard-KI-Anbieter hinterlegt - bitte zuerst unter Einstellungen anlegen."
        )

    # Provider-Felder als plain dict einfrieren: das ORM-Objekt gehört zur
    # Request-Session, die nach Antwortende geschlossen wird - der Hintergrund-
    # Job hätte sonst mit einer detached Instanz zu tun.
    provider_config = {
        "provider_type": provider.provider_type,
        "base_url": provider.base_url,
        "api_key": provider.api_key,
        "default_model": provider.default_model,
    }

    async def _run():
        job_db = SessionLocal()
        provider_ns = SimpleNamespace(**provider_config)
        try:
            remaining = count_untranslated(job_db)
            while remaining > 0:
                translated = await translate_all_exercises(job_db, provider_ns, batch_size=20)
                if translated == 0:
                    break
                remaining = count_untranslated(job_db)
        except Exception:
            # Netzwerk-/API-Fehler dürfen den Thread nicht unbemerkt abwürgen -
            # der Frontend-Poll erkennt den Stillstand (untranslated bleibt konstant).
            import logging

            logging.getLogger("uvicorn.error").exception("Übersetzungs-Job fehlgeschlagen")
        finally:
            job_db.close()

    background_tasks.add_task(_run)
    return {"status": "gestartet", "untranslated": count_untranslated(db)}
