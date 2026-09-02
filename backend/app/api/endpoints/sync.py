import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.institucion import Institucion, EstadoActual, SnapshotDiario, HistorialCambios
from app.schemas.institucion import SyncScrapePayload
from app.services.business_logic import evaluar_nivel_alerta

logger = logging.getLogger("sync_service")
router = APIRouter(prefix="/internal", tags=["Sincronización Interna Scraper"])

@router.post("/sync-scrape")
def sync_scrape_data(payload: SyncScrapePayload, db: Session = Depends(get_db)):
    run_type = payload.run_type
    scrape_data = payload.scrape_result.get("data", [])
    timestamp_str = payload.scrape_result.get("timestamp")
    
    logger.info(f"Procesando sincronización de scraping. Tipo: {run_type}, Total items: {len(scrape_data)}")

    from zoneinfo import ZoneInfo
    try:
        asuncion_tz = ZoneInfo("America/Asuncion")
        snapshot_dt = datetime.now(asuncion_tz).replace(tzinfo=None)
    except Exception:
        snapshot_dt = datetime.now()

    cambios_registrados = 0

    cache_estado_actual = {}

    for item in scrape_data:
        raw_nombre = item.get("nombre", "").strip()
        if not raw_nombre or len(raw_nombre) > 200 or any(k in raw_nombre.upper() for k in ["MODIFICAR", "NOMBRE INSTITUCIÓN", "SISTEMA BIC", "ESTADO INSTITUCIONES", "BÚSQUEDA"]):
            continue

        nombre = raw_nombre[:245]
        estado = str(item.get("estado", "Desconocido"))[:95]
        cant_max = item.get("cant_max_busquedas", 0)
        fecha_carga = str(item.get("fecha_ultima_carga"))[:95] if item.get("fecha_ultima_carga") else None
        calidad = str(item.get("calidad_datos", "N.A"))[:45]
        motivo = item.get("motivo_suspension")
        vencimiento = str(item.get("vencimiento_validacion"))[:95] if item.get("vencimiento_validacion") else None
        categoria = str(item.get("categoria_tabla", estado))[:95]

        # 1. Obtener o crear catálogo de Institución
        # Buscar por nombre exacto o dentro de los alias
        inst = db.query(Institucion).filter(
            (Institucion.nombre == nombre) |
            (Institucion.alias_nombres.any(nombre))
        ).first()
        
        if not inst:
            inst = Institucion(nombre=nombre)
            db.add(inst)
            db.flush()

        # 2. Evaluar nivel de alerta y horas hábiles
        hrs_trans, hrs_rest, nivel_alerta = evaluar_nivel_alerta(estado, fecha_carga)

        # 3. Actualizar o crear EstadoActual (usando cache local para evitar duplicados en la sesión)
        if inst.id in cache_estado_actual:
            estado_act = cache_estado_actual[inst.id]
        else:
            estado_act = db.query(EstadoActual).filter(EstadoActual.institucion_id == inst.id).first()
            if estado_act:
                cache_estado_actual[inst.id] = estado_act

        estado_anterior = None

        if estado_act:
            estado_anterior = estado_act.estado
            estado_act.estado = estado
            estado_act.cant_max_busquedas = cant_max
            estado_act.fecha_ultima_carga = fecha_carga
            estado_act.calidad_datos = calidad
            estado_act.motivo_suspension = motivo
            estado_act.vencimiento_validacion = vencimiento
            estado_act.categoria_tabla = categoria
            estado_act.actualizado_el = snapshot_dt
            estado_act.horas_habiles_transcurridas = hrs_trans
            estado_act.horas_habiles_restantes = hrs_rest
            estado_act.nivel_alerta = nivel_alerta
        else:
            estado_act = EstadoActual(
                institucion_id=inst.id,
                estado=estado,
                cant_max_busquedas=cant_max,
                fecha_ultima_carga=fecha_carga,
                calidad_datos=calidad,
                motivo_suspension=motivo,
                vencimiento_validacion=vencimiento,
                categoria_tabla=categoria,
                actualizado_el=snapshot_dt,
                horas_habiles_transcurridas=hrs_trans,
                horas_habiles_restantes=hrs_rest,
                nivel_alerta=nivel_alerta
            )
            db.add(estado_act)
            cache_estado_actual[inst.id] = estado_act

        # 4. Si el estado cambió, registrar en HistorialCambios
        if estado_anterior and estado_anterior.upper() != estado.upper():
            log_cambio = HistorialCambios(
                institucion_id=inst.id,
                estado_anterior=estado_anterior,
                estado_nuevo=estado,
                fecha_deteccion=snapshot_dt,
                corrida_origen=run_type,
                detalle_cambio=f"Cambio detectado de '{estado_anterior}' a '{estado}' ({categoria})"
            )
            db.add(log_cambio)
            cambios_registrados += 1

        # 5. Si la corrida es FULL (07:00 hs), registrar SnapshotDiario oficial
        if run_type == "FULL":
            snap = SnapshotDiario(
                institucion_id=inst.id,
                fecha_snapshot=snapshot_dt,
                estado=estado,
                cant_max_busquedas=cant_max,
                fecha_ultima_carga=fecha_carga,
                calidad_datos=calidad,
                motivo_suspension=motivo,
                vencimiento_validacion=vencimiento,
                categoria_tabla=categoria
            )
            db.add(snap)

    # 6. Limpiar instituciones que desaparecieron del portal (ya no están en scrape_data)
    # Eliminamos su EstadoActual para que no sumen en el total ni aparezcan en el dashboard
    if len(scrape_data) > 0:
        procesados_ids = list(cache_estado_actual.keys())
        estados_huerfanos = db.query(EstadoActual).filter(~EstadoActual.institucion_id.in_(procesados_ids)).all()
        for estado_huerfano in estados_huerfanos:
            logger.info(f"Institución ID {estado_huerfano.institucion_id} desapareció del portal. Eliminando su estado actual.")
            log_cambio = HistorialCambios(
                institucion_id=estado_huerfano.institucion_id,
                estado_anterior=estado_huerfano.estado,
                estado_nuevo="Desaparecida del Portal",
                fecha_deteccion=snapshot_dt,
                corrida_origen=run_type,
                detalle_cambio="La institución ya no figura en ninguna tabla del portal BICSA."
            )
            db.add(log_cambio)
            db.delete(estado_huerfano)
            cambios_registrados += 1

    db.commit()
    logger.info(f"Sincronización finalizada con éxito. Cambios de estado registrados: {cambios_registrados}")
    
    # Auto-generar y guardar copia Excel en Backup_Scraping
    try:
        from app.api.endpoints.instituciones import guardar_backup_excel
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
        saved_file = guardar_backup_excel(lista_datos)
        logger.info(f"Backup de Excel guardado automáticamente en Backup_Scraping/{saved_file}")
    except Exception as err:
        logger.error(f"Error al auto-guardar backup Excel: {err}")

    return {
        "status": "SUCCESS",
        "total_procesados": len(scrape_data),
        "cambios_detectados": cambios_registrados,
        "run_type": run_type
    }
