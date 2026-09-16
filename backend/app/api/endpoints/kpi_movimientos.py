from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.kpi_movimientos import (
    obtener_reporte_bajas,
    obtener_reporte_altas,
    generar_excel_bajas,
    generar_excel_altas,
)

router = APIRouter(prefix="/kpi-movimientos", tags=["KPI Altas y Bajas de Instituciones"])


@router.get("/bajas/anual")
def get_kpi_bajas(
    anio: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    anio = anio or str(datetime.now().year)
    return obtener_reporte_bajas(db, anio)


@router.get("/bajas/exportar-excel")
def exportar_excel_bajas(
    anio: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    anio = anio or str(datetime.now().year)
    reporte = obtener_reporte_bajas(db, anio)
    excel_buffer = generar_excel_bajas(reporte["detalle"], anio)
    filename = f"Desvinculadas_{anio}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/altas/anual")
def get_kpi_altas(
    anio: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    anio = anio or str(datetime.now().year)
    return obtener_reporte_altas(db, anio)


@router.get("/altas/exportar-excel")
def exportar_excel_altas(
    anio: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    anio = anio or str(datetime.now().year)
    reporte = obtener_reporte_altas(db, anio)
    excel_buffer = generar_excel_altas(reporte["detalle"], anio)
    filename = f"Altas_{anio}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
