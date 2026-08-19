import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
from typing import List

from app.db.session import get_db
from app.models.institucion import Institucion, EstadoActual

router = APIRouter(prefix="/api/v1/contactos", tags=["Contactos"])

class ContactoUpdatePayload(BaseModel):
    telefonos: List[str] = Field(..., max_items=2)
    usuario: str = Field(..., description="Email del admin que actualiza el contacto")

@router.get("/pendientes")
def get_contactos_pendientes(db: Session = Depends(get_db)):
    """
    Lista instituciones sin telefonos_contacto cargado.
    Excluye instituciones con estado_actual en ['Desvinculada', 'Suspendida'].
    """
    instituciones = db.query(Institucion).join(EstadoActual).filter(
        or_(Institucion.telefonos_contacto == None, Institucion.telefonos_contacto == '{}'),
        ~EstadoActual.estado.ilike('%Desvinculad%'),
        ~EstadoActual.estado.ilike('%Suspendid%'),
        ~EstadoActual.categoria_tabla.ilike('%Desvinculad%'),
        ~EstadoActual.categoria_tabla.ilike('%Suspendid%'),
        ~Institucion.nombre.contains('@') # Excluir usuarios o falsas instituciones
    ).all()
    
    return [
        {
            "id": inst.id,
            "nombre": inst.nombre,
            "estado_actual": inst.estado_actual.estado if inst.estado_actual else "Desconocido",
            "categoria_tabla": inst.estado_actual.categoria_tabla if inst.estado_actual else "Desconocido",
            "telefonos_contacto": inst.telefonos_contacto or []
        }
        for inst in instituciones
    ]

@router.get("/cargados")
def get_contactos_cargados(db: Session = Depends(get_db)):
    """
    Lista instituciones que YA tienen al menos 1 teléfono cargado.
    """
    instituciones = db.query(Institucion).filter(
        Institucion.telefonos_contacto != None,
        Institucion.telefonos_contacto != '{}'
    ).all()
    
    return [
        {
            "id": inst.id,
            "nombre": inst.nombre,
            "telefonos_contacto": inst.telefonos_contacto,
            "contacto_actualizado_en": inst.contacto_actualizado_en,
            "contacto_actualizado_por": inst.contacto_actualizado_por
        }
        for inst in instituciones
    ]

@router.put("/{institucion_id}")
def update_contactos(institucion_id: int, payload: ContactoUpdatePayload, db: Session = Depends(get_db)):
    """
    Actualiza los teléfonos de contacto de una institución (máximo 2).
    """
    inst = db.query(Institucion).filter(Institucion.id == institucion_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
        
    inst.telefonos_contacto = payload.telefonos
    inst.contacto_actualizado_en = datetime.datetime.utcnow()
    inst.contacto_actualizado_por = payload.usuario
    
    db.commit()
    return {"status": "ok", "telefonos": inst.telefonos_contacto}
