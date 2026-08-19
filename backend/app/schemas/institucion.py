from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class EstadoActualResponse(BaseModel):
    id: int
    institucion_id: int
    nombre_institucion: str
    estado: str
    cant_max_busquedas: int
    fecha_ultima_carga: Optional[str] = None
    calidad_datos: Optional[str] = None
    motivo_suspension: Optional[str] = None
    vencimiento_validacion: Optional[str] = None
    categoria_tabla: str
    actualizado_el: datetime
    horas_habiles_transcurridas: float
    horas_habiles_restantes: float
    nivel_alerta: str
    telefonos_contacto: Optional[List[str]] = []

    class Config:
        from_attributes = True

class KPIResponse(BaseModel):
    total_instituciones: int
    activas: int
    bloqueadas: int
    suspendidas: int
    suspendida_carga: int = 0
    excepcion_carga: int
    validacion_xml: int
    en_alerta_critica: int
    en_alerta_advertencia: int
    ultima_actualizacion: Optional[str] = None
    conteo_categorias: Optional[dict] = None

class HistorialCambioResponse(BaseModel):
    id: int
    institucion_id: int
    nombre_institucion: str
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    fecha_deteccion: datetime
    corrida_origen: str
    detalle_cambio: Optional[str] = None

    class Config:
        from_attributes = True

class SyncScrapePayload(BaseModel):
    run_type: str = "FULL"
    scrape_result: dict
