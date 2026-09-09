from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.kpi_cargas import (
    obtener_reporte_cargas_mensuales,
    ejecutar_backfill_historico,
    obtener_historial_cargas_institucion,
    _calcular_filas_mes,
    generar_excel_cargas_mensuales,
    _calcular_matriz_anual,
    generar_excel_vista_anual,
    obtener_limite_consultas,
    guardar_cierre_manual_limite_consultas,
)

router = APIRouter(prefix="/kpi-cargas", tags=["KPI Cargas Mensuales"])


@router.get("/mensual")
def get_kpi_cargas_mensual(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return obtener_reporte_cargas_mensuales(db)


@router.get("/mensual/exportar-excel")
def exportar_excel_cargas_mensuales(mes: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    reporte = obtener_reporte_cargas_mensuales(db)
    if mes not in reporte["meses"]:
        raise HTTPException(status_code=404, detail="No hay datos para el mes solicitado.")

    filas = _calcular_filas_mes(reporte, mes)
    excel_buffer = generar_excel_cargas_mensuales(filas, mes)
    filename = f"Cierre_Carga_Mensual_{mes}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/anual/exportar-excel")
def exportar_excel_vista_anual(anio: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    reporte = obtener_reporte_cargas_mensuales(db)
    anios_disponibles = {m.split("-")[0] for m in reporte["meses"]}
    if anio not in anios_disponibles:
        raise HTTPException(status_code=404, detail="No hay datos para el año solicitado.")

    filas = _calcular_matriz_anual(reporte, anio)
    excel_buffer = generar_excel_vista_anual(filas, anio)
    filename = f"Vista_Anual_Cargas_{anio}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/institucion/{institucion_id}/historial")
def get_historial_cargas_institucion(institucion_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return obtener_historial_cargas_institucion(db, institucion_id)


@router.post("/backfill-historico")
def post_backfill_historico(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden ejecutar la sincronización histórica.")
    return ejecutar_backfill_historico(db)


@router.get("/limite-consultas")
def get_limite_consultas(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return obtener_limite_consultas(db)


class CierreManualPayload(BaseModel):
    institucion_id: int
    mes: str
    valor: int


@router.post("/limite-consultas/cargar")
def post_cargar_limite_consultas(payload: CierreManualPayload, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        return guardar_cierre_manual_limite_consultas(db, payload.institucion_id, payload.mes, payload.valor, current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
