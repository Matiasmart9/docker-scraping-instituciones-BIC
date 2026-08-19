import httpx
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.institucion import Institucion

router = APIRouter(prefix="/api/v1/notificaciones", tags=["Notificaciones WhatsApp"])

class RecordatorioRequest(BaseModel):
    mensaje_custom: Optional[str] = None

@router.post("/instituciones/{institucion_id}/enviar-recordatorio")
async def enviar_recordatorio(institucion_id: int, req: Optional[RecordatorioRequest] = None, db: Session = Depends(get_db)):
    institucion = db.query(Institucion).filter(Institucion.id == institucion_id).first()
    if not institucion:
        raise HTTPException(404, "Institución no encontrada")
        
    if not institucion.telefonos_contacto:
        raise HTTPException(400, "La institución no tiene contactos cargados")

    estado_actual = institucion.estado_actual
    nivel_alerta = estado_actual.nivel_alerta if estado_actual else "Desconocido"
    fecha_ultima = "Desconocida"
    if estado_actual and estado_actual.fecha_ultima_carga:
        if isinstance(estado_actual.fecha_ultima_carga, str):
            fecha_str = estado_actual.fecha_ultima_carga
            # Puede venir con 'T' o con espacio
            fecha_solo = fecha_str.split("T")[0].split(" ")[0]
            # Si tiene formato YYYY-MM-DD, lo pasamos a DD/MM/YYYY
            partes = fecha_solo.split("-")
            if len(partes) == 3:
                fecha_ultima = f"{partes[2]}/{partes[1]}/{partes[0]}"
            else:
                fecha_ultima = fecha_solo
        else:
            fecha_ultima = estado_actual.fecha_ultima_carga.strftime("%d/%m/%Y")

    if req and req.mensaje_custom:
        mensaje = req.mensaje_custom.format(
            institucion=institucion.nombre,
            alerta=nivel_alerta,
            fecha=fecha_ultima
        )
    else:
        mensaje = (
            f"⚠️ Recordatorio de carga XML\n\n"
            f"Institución: {institucion.nombre}\n"
            f"Nivel de alerta: {nivel_alerta}\n"
            f"Fecha de última carga: {fecha_ultima}\n\n"
            f"Por favor realizar la carga a la brevedad."
        )

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "http://whatsapp:8002/send",
                json={"telefonos": institucion.telefonos_contacto, "mensaje": mensaje},
                timeout=15.0
            )
        
        if resp.status_code == 200:
            return resp.json()
        else:
            raise HTTPException(500, f"Error del servicio WhatsApp: {resp.text}")
    except Exception as e:
        raise HTTPException(500, f"No se pudo contactar al servicio de WhatsApp: {str(e)}")

@router.get("/status")
async def get_whatsapp_status():
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("http://whatsapp:8002/status", timeout=5.0)
            if resp.status_code == 200:
                return resp.json()
            return {"conectado": False, "error": "Código de estado no exitoso"}
    except Exception as e:
        return {"conectado": False, "error": str(e)}
