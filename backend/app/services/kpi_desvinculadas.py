import io
from datetime import datetime
from collections import defaultdict

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app.models.institucion import Institucion, EstadoActual, HistorialCambios

MESES_NOMBRE = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

# Cuando se migran o siembran datos en bloque (por ejemplo, la carga inicial del
# sistema) pueden registrarse decenas de "transiciones a Desvinculada" el mismo
# día, que no representan bajas reales sino ruido de inicialización. Un día
# real de operación nunca desvincula tantas instituciones a la vez, así que se
# descarta cualquier día que supere este umbral para no inflar el reporte.
UMBRAL_DIA_MASIVO = 20


def obtener_reporte_desvinculadas(db: Session, anio: str) -> dict:
    """
    Detecta instituciones que pasaron a estado 'Desvinculada' (desde cualquier
    estado anterior), usando el historial de cambios de estado que el scraper ya
    registra en cada corrida (HistorialCambios) apenas detecta la transición — no
    hace falta ningún backfill ni reconstrucción a partir de backups.

    Agrupa por mes calendario del año pedido (los 12 meses, aunque no haya datos
    en alguno) e incluye, por institución, su 'Última Carga XML' vigente (o
    'Sin Datos' si nunca llegó a registrar una carga real).
    """
    todos_los_cambios = db.query(HistorialCambios).filter(
        HistorialCambios.estado_nuevo.ilike("%DESVINCULAD%")
    ).order_by(HistorialCambios.fecha_deteccion.asc()).all()

    conteo_por_dia = defaultdict(int)
    for c in todos_los_cambios:
        conteo_por_dia[c.fecha_deteccion.strftime("%Y-%m-%d")] += 1
    cambios = [c for c in todos_los_cambios if conteo_por_dia[c.fecha_deteccion.strftime("%Y-%m-%d")] <= UMBRAL_DIA_MASIVO]

    anio_actual = str(datetime.now().year)
    anios_set = {c.fecha_deteccion.strftime("%Y") for c in cambios}
    anios_set.add(anio_actual)
    anios_disponibles = sorted(anios_set)

    institucion_ids = {c.institucion_id for c in cambios}

    instituciones_map = {}
    estados_map = {}
    if institucion_ids:
        for inst in db.query(Institucion).filter(Institucion.id.in_(institucion_ids)).all():
            instituciones_map[inst.id] = inst.nombre
        for e in db.query(EstadoActual).filter(EstadoActual.institucion_id.in_(institucion_ids)).all():
            estados_map[e.institucion_id] = e.fecha_ultima_carga

    por_mes = defaultdict(list)
    for c in cambios:
        if c.fecha_deteccion.strftime("%Y") != anio:
            continue
        mes = c.fecha_deteccion.strftime("%Y-%m")
        ultima_carga = estados_map.get(c.institucion_id) or None
        por_mes[mes].append({
            "institucion_id": c.institucion_id,
            "nombre": instituciones_map.get(c.institucion_id, "Institución desconocida"),
            "fecha_desvinculacion": c.fecha_deteccion.strftime("%Y-%m-%d"),
            "estado_anterior": c.estado_anterior or "-",
            "ultima_carga_xml": ultima_carga,
        })

    meses = []
    detalle = []
    for m in range(1, 13):
        clave = f"{anio}-{m:02d}"
        items = sorted(por_mes.get(clave, []), key=lambda x: x["fecha_desvinculacion"])
        meses.append({
            "mes": clave,
            "nombre_mes": MESES_NOMBRE[m - 1],
            "cantidad": len(items),
        })
        detalle.extend(items)

    return {
        "anio": anio,
        "anios_disponibles": anios_disponibles,
        "meses": meses,
        "detalle": detalle,
        "total_anio": len(detalle),
    }


def generar_excel_desvinculadas(detalle: list[dict], anio: str) -> io.BytesIO:
    """
    Genera un Excel estilizado con el detalle de instituciones desvinculadas en
    el año pedido, con el mismo criterio visual profesional de los demás reportes.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Desvinculadas {anio}"
    ws.views.sheetView[0].showGridLines = True

    NAVY_HEADER = "1E293B"
    WHITE_TEXT = "FFFFFF"
    BORDER_COLOR = "CBD5E1"

    font_title = Font(name="Calibri", size=16, bold=True, color="0F172A")
    font_subtitle = Font(name="Calibri", size=10, italic=True, color="64748B")
    font_header = Font(name="Calibri", size=11, bold=True, color=WHITE_TEXT)
    font_cell = Font(name="Calibri", size=10, color="0F172A")
    font_cell_sin_datos = Font(name="Calibri", size=10, italic=True, color="94A3B8")
    font_bold = Font(name="Calibri", size=10, bold=True, color="0F172A")

    thin_border = Border(
        left=Side(style="thin", color=BORDER_COLOR),
        right=Side(style="thin", color=BORDER_COLOR),
        top=Side(style="thin", color=BORDER_COLOR),
        bottom=Side(style="thin", color=BORDER_COLOR),
    )

    headers = ["Institución", "Mes", "Fecha de Desvinculación", "Estado Anterior", "Última Carga XML"]

    ws.merge_cells(f"A1:{get_column_letter(len(headers))}1")
    ws["A1"] = f"INSTITUCIONES DESVINCULADAS - {anio}"
    ws["A1"].font = font_title

    ws.merge_cells(f"A2:{get_column_letter(len(headers))}2")
    ws["A2"] = (
        f"Reporte generado el {datetime.now().strftime('%d/%m/%Y a las %H:%M:%S')}. "
        f"Instituciones que pasaron a estado 'Desvinculada' durante el año {anio}."
    )
    ws["A2"].font = font_subtitle

    row_idx = 4
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=header)
        cell.font = font_header
        cell.fill = PatternFill(start_color=NAVY_HEADER, end_color=NAVY_HEADER, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[row_idx].height = 24

    row_idx = 5
    for fila in detalle:
        mes_idx = int(fila["fecha_desvinculacion"][5:7])
        mes_nombre = f"{MESES_NOMBRE[mes_idx - 1]} {anio}"
        fecha_fmt = datetime.strptime(fila["fecha_desvinculacion"], "%Y-%m-%d").strftime("%d/%m/%Y")

        ws.cell(row=row_idx, column=1, value=fila["nombre"]).font = font_bold
        ws.cell(row=row_idx, column=2, value=mes_nombre).font = font_cell
        ws.cell(row=row_idx, column=3, value=fecha_fmt).font = font_cell
        ws.cell(row=row_idx, column=4, value=fila["estado_anterior"]).font = font_cell

        c_ultima = ws.cell(row=row_idx, column=5)
        if fila["ultima_carga_xml"]:
            c_ultima.value = fila["ultima_carga_xml"]
            c_ultima.font = font_cell
        else:
            c_ultima.value = "Sin Datos"
            c_ultima.font = font_cell_sin_datos

        for col_idx in range(1, len(headers) + 1):
            ws.cell(row=row_idx, column=col_idx).alignment = Alignment(horizontal="center" if col_idx > 1 else "left", vertical="center")
            ws.cell(row=row_idx, column=col_idx).border = thin_border
        row_idx += 1

    if not detalle:
        ws.cell(row=row_idx, column=1, value="Sin instituciones desvinculadas en el año seleccionado.").font = font_cell_sin_datos

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
    ws.column_dimensions["A"].width = 42

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
