from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.kpi_desvinculadas import obtener_reporte_desvinculadas, generar_excel_desvinculadas

router = APIRouter(prefix="/kpi-desvinculadas", tags=["KPI Desvinculadas"])


@router.get("/anual")
def get_kpi_desvinculadas(
    anio: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    anio = anio or str(datetime.now().year)
    return obtener_reporte_desvinculadas(db, anio)


@router.get("/exportar-excel")
def exportar_excel_desvinculadas(
    anio: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    anio = anio or str(datetime.now().year)
    reporte = obtener_reporte_desvinculadas(db, anio)
    excel_buffer = generar_excel_desvinculadas(reporte["detalle"], anio)
    filename = f"Desvinculadas_{anio}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
