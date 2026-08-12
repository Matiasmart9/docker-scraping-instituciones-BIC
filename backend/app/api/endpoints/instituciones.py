import os
import requests
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.institucion import Institucion, EstadoActual, HistorialCambios
from app.schemas.institucion import EstadoActualResponse, KPIResponse, HistorialCambioResponse
from app.services.excel_generator import generar_excel_instituciones
from app.core.security import get_current_user

router = APIRouter(prefix="/instituciones", tags=["Instituciones"])
SCRAPER_URL = os.getenv("SCRAPER_URL", "http://scraper:8001")

@router.get("/kpis", response_model=KPIResponse)
def get_dashboard_kpis(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    estados = db.query(EstadoActual).join(Institucion).filter(~Institucion.nombre.contains("@")).all()
    
    total = len(estados)
    bloqueadas = sum(1 for e in estados if "BLOQUEA" in e.estado.upper() or "BLOQUEA" in e.categoria_tabla.upper())
    suspendidas = sum(1 for e in estados if "SUSPEND" in e.estado.upper() or "SUSPEND" in e.categoria_tabla.upper())
    excepcion = sum(1 for e in estados if "EXCEPCI" in e.estado.upper() or "EXCEPCI" in e.categoria_tabla.upper())
    validacion = sum(1 for e in estados if "VALIDACI" in e.estado.upper() or "VALIDACI" in e.categoria_tabla.upper())
    desvinculadas = sum(1 for e in estados if "DESVINCULAD" in e.estado.upper() or "DESVINCULAD" in e.categoria_tabla.upper())
    limite_consultas = sum(1 for e in estados if "LÍMITE" in e.estado.upper() or "LIMITE" in e.estado.upper() or "LÍMITE" in e.categoria_tabla.upper() or "LIMITE" in e.categoria_tabla.upper())
    
    # Activas puras (excluyendo limite de consultas)
    activas = sum(1 for e in estados if "ACTIV" in e.estado.upper() and not ("LÍMITE" in e.estado.upper() or "LIMITE" in e.estado.upper() or "LÍMITE" in e.categoria_tabla.upper() or "LIMITE" in e.categoria_tabla.upper()))
    
    criticas = sum(1 for e in estados if e.nivel_alerta == "CRITICO")
    advertencias = sum(1 for e in estados if e.nivel_alerta == "ADVERTENCIA")

    ult_act = None
    if estados:
        max_dt = max(e.actualizado_el for e in estados if e.actualizado_el)
        from zoneinfo import ZoneInfo
        try:
            asuncion_now = datetime.now(ZoneInfo("America/Asuncion")).replace(tzinfo=None)
            if max_dt > asuncion_now:
                from datetime import timedelta
                max_dt = max_dt - timedelta(hours=3)
        except Exception:
            pass
        ult_act = max_dt.strftime("%d/%m/%Y %H:%M:%S")

    conteo = {
        "Todas": total,
        "Activa": activas,
        "Suspendida": suspendidas,
        "Bloqueada": bloqueadas,
        "Con excepción de carga": excepcion,
        "Desvinculada": desvinculadas,
        "Validación de XML": validacion,
        "Activa (límite de consultas)": limite_consultas
    }

    return {
        "total_instituciones": total,
        "activas": activas,
        "bloqueadas": bloqueadas,
        "suspendidas": suspendidas,
        "excepcion_carga": excepcion,
        "validacion_xml": validacion,
        "en_alerta_critica": criticas,
        "en_alerta_advertencia": advertencias,
        "ultima_actualizacion": ult_act,
        "conteo_categorias": conteo
    }

@router.get("/estado-actual", response_model=List[EstadoActualResponse])
def get_estado_actual(
    categoria: Optional[str] = None,
    alerta: Optional[str] = None,
    busqueda: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retorna el estado actual de las instituciones con filtros opcionales.
    """
    query = db.query(EstadoActual).join(Institucion).filter(~Institucion.nombre.contains("@"))

    if categoria:
        cat_lower = categoria.lower()
        if "limite" in cat_lower or "límite" in cat_lower:
            query = query.filter(
                (EstadoActual.categoria_tabla.ilike("%límite%")) | 
                (EstadoActual.categoria_tabla.ilike("%limite%")) |
                (EstadoActual.estado.ilike("%límite%")) |
                (EstadoActual.estado.ilike("%limite%"))
            )
        elif cat_lower == "activa":
            query = query.filter(
                (EstadoActual.categoria_tabla.ilike("%activa%")) | (EstadoActual.estado.ilike("%activa%"))
            ).filter(
                ~EstadoActual.categoria_tabla.ilike("%límite%"),
                ~EstadoActual.categoria_tabla.ilike("%limite%"),
                ~EstadoActual.estado.ilike("%límite%"),
                ~EstadoActual.estado.ilike("%limite%")
            )
        else:
            query = query.filter(
                (EstadoActual.categoria_tabla.ilike(f"%{categoria}%")) | (EstadoActual.estado.ilike(f"%{categoria}%"))
            )
    if alerta:
        query = query.filter(EstadoActual.nivel_alerta == alerta.upper())
    if busqueda:
        query = query.filter(Institucion.nombre.ilike(f"%{busqueda}%"))

    resultados = query.all()
    
    # Formatear respuesta con el nombre de la institución
    response = []
    for r in resultados:
        item_dict = {
            "id": r.id,
            "institucion_id": r.institucion_id,
            "nombre_institucion": r.institucion.nombre if r.institucion else "N/A",
            "estado": r.estado,
            "cant_max_busquedas": r.cant_max_busquedas,
            "fecha_ultima_carga": r.fecha_ultima_carga,
            "calidad_datos": r.calidad_datos,
            "motivo_suspension": r.motivo_suspension,
            "vencimiento_validacion": r.vencimiento_validacion,
            "categoria_tabla": r.categoria_tabla,
            "actualizado_el": r.actualizado_el,
            "horas_habiles_transcurridas": r.horas_habiles_transcurridas or 0.0,
            "horas_habiles_restantes": r.horas_habiles_restantes if r.horas_habiles_restantes is not None else 72.0,
            "nivel_alerta": r.nivel_alerta or "NORMAL"
        }
        response.append(item_dict)

    return response

@router.get("/historial", response_model=List[HistorialCambioResponse])
def get_historial_cambios(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    historial = db.query(HistorialCambios).join(Institucion).order_by(HistorialCambios.fecha_deteccion.desc()).limit(limit).all()
    
    res = []
    for h in historial:
        res.append({
            "id": h.id,
            "institucion_id": h.institucion_id,
            "nombre_institucion": h.institucion.nombre if h.institucion else "N/A",
            "estado_anterior": h.estado_anterior,
            "estado_nuevo": h.estado_nuevo,
            "fecha_deteccion": h.fecha_deteccion,
            "corrida_origen": h.corrida_origen,
            "detalle_cambio": h.detalle_cambio
        })
    return res

BACKUP_DIR = "/app/Backup_Scraping"

def guardar_backup_excel(lista_datos):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    excel_buffer = generar_excel_instituciones(lista_datos)
    # Un solo archivo por día (reemplaza si se ejecuta varias veces en la misma fecha)
    now_str = datetime.now().strftime("%Y_%m_%d")
    filename = f"BICSA_Reporte_{now_str}.xlsx"
    filepath = os.path.join(BACKUP_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(excel_buffer.getvalue())
    return filename

@router.get("/exportar-excel")
def exportar_excel_instituciones(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    estados = db.query(EstadoActual).join(Institucion).filter(~Institucion.nombre.contains("@")).all()
    
    lista_datos = []
    for e in estados:
        lista_datos.append({
            "nombre": e.institucion.nombre if e.institucion else "N/A",
            "estado": e.estado,
            "categoria_tabla": e.categoria_tabla,
            "cant_max_busquedas": e.cant_max_busquedas,
            "fecha_ultima_carga": e.fecha_ultima_carga or "N/A",
            "calidad_datos": e.calidad_datos or "N.A",
            "motivo_suspension": e.motivo_suspension or "-",
            "vencimiento_validacion": e.vencimiento_validacion or "-",
            "horas_habiles_restantes": e.horas_habiles_restantes if e.horas_habiles_restantes is not None else 72.0,
            "nivel_alerta": e.nivel_alerta or "NORMAL"
        })

    excel_buffer = generar_excel_instituciones(lista_datos)
    filename = f"BICSA_Estado_Instituciones_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    # Auto-guardar copia en Backup_Scraping
    try:
        guardar_backup_excel(lista_datos)
    except Exception:
        pass

    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

@router.get("/backups")
def obtener_lista_backups(current_user = Depends(get_current_user)):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    archivos = []
    for f in os.listdir(BACKUP_DIR):
        if f.endswith(".xlsx"):
            fpath = os.path.join(BACKUP_DIR, f)
            stat = os.stat(fpath)
            mod_time = datetime.fromtimestamp(stat.st_mtime)
            archivos.append({
                "filename": f,
                "size_bytes": stat.st_size,
                "size_str": f"{round(stat.st_size / 1024, 1)} KB",
                "fecha_modificacion": mod_time.strftime("%d/%m/%Y %H:%M:%S"),
                "year": str(mod_time.year),
                "month": str(mod_time.month).zfill(2),
                "day": str(mod_time.day).zfill(2)
            })
    archivos.sort(key=lambda x: x["filename"], reverse=True)
    return archivos

@router.get("/backups/download/{filename}")
def descargar_backup_file(filename: str, current_user = Depends(get_current_user)):
    from fastapi.responses import FileResponse
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo de backup no encontrado")
    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )

@router.delete("/backups/{filename}")
def eliminar_backup_file(filename: str, current_user = Depends(get_current_user)):
    filepath = os.path.join(BACKUP_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return {"status": "SUCCESS", "message": f"Archivo {filename} eliminado correctamente"}
    raise HTTPException(status_code=404, detail="Archivo no encontrado")

@router.post("/limpiar-base")
def limpiar_base_datos(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db.query(HistorialCambios).delete()
    db.query(EstadoActual).delete()
    db.query(SnapshotDiario).delete()
    db.query(Institucion).delete()
    db.commit()
    return {"status": "SUCCESS", "message": "Base de datos e historial limpiados exitosamente"}

@router.post("/trigger-scrape")
def trigger_manual_scraping(current_user = Depends(get_current_user)):
    try:
        url = f"{SCRAPER_URL}/trigger-scrape"
        res = requests.post(url, json={"run_type": "MANUAL"}, timeout=5)
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al conectar con el scraper: {str(e)}")
