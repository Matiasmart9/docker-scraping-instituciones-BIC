from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.configuracion_scraper import (
    obtener_configuracion_scraper,
    actualizar_configuracion_scraper,
    serializar_configuracion_scraper,
)

router = APIRouter(prefix="/configuracion", tags=["Configuración"])


@router.get("/scraper")
def get_configuracion_scraper(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return serializar_configuracion_scraper(obtener_configuracion_scraper(db))


class ConfiguracionScraperPayload(BaseModel):
    lunes: bool
    martes: bool
    miercoles: bool
    jueves: bool
    viernes: bool
    sabado: bool
    domingo: bool


@router.put("/scraper")
def put_configuracion_scraper(
    payload: ConfiguracionScraperPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden cambiar la configuración del scraper.")
    config = actualizar_configuracion_scraper(db, payload.dict(), current_user.email)
    return serializar_configuracion_scraper(config)
