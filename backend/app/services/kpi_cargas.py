import io
import os
import re
import logging
from datetime import datetime, date, timedelta
from collections import defaultdict

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app.models.institucion import Institucion, EstadoActual, SnapshotDiario, CierreManualLimiteConsultas
from app.services.business_logic import parse_fecha_bicsa

logger = logging.getLogger("kpi_cargas")

BACKUP_DIR = "/app/Backup_Scraping"
NOMBRE_ARCHIVO_REGEX = re.compile(r"BICSA_Reporte_(\d{4})_(\d{2})_(\d{2})\.xlsx$", re.IGNORECASE)


# Mes calendario a partir del cual el histórico es confiable (primer backup diario
# disponible en Backup_Scraping cubre desde el 12/08/2026, permitiendo reconstruir
# el mes de Agosto/2026 completo en adelante). Fechas anteriores a este piso no se
# consideran para el KPI, evitando arrastrar valores corruptos o desactualizados
# que a veces trae el portal de origen (ej. instituciones con una fecha de 2018).
MES_INICIO_HISTORICO = "2026-08"


def _es_desvinculada(*valores: str) -> bool:
    for v in valores:
        if v and "DESVINCULAD" in v.upper():
            return True
    return False


def _es_validacion_xml(*valores: str) -> bool:
    for v in valores:
        if v and "VALIDACI" in v.upper():
            return True
    return False


def _es_limite_consultas(*valores: str) -> bool:
    for v in valores:
        if not v:
            continue
        v_up = v.upper()
        if "LÍMITE" in v_up or "LIMITE" in v_up:
            return True
    return False


def _sumar_meses(mes: str, delta: int) -> str:
    anio, m = (int(x) for x in mes.split("-"))
    idx = (anio * 12 + (m - 1)) + delta
    return f"{idx // 12:04d}-{(idx % 12) + 1:02d}"


def _leer_backup_excel(filepath: str) -> list[dict]:
    """
    Lee un backup Excel generado por generar_excel_instituciones() y devuelve
    una lista de dicts con las columnas relevantes. Layout fijo:
    Fila 6 = encabezados, fila 7+ = datos.
    Col 1: Nombre | 2: Estado | 3: Categoría Tabla | 4: Búsquedas Máx.
    5: Fecha Última Carga | 6: Calidad Datos | 7: Motivo Suspensión | 8: Vencimiento Validación
    """
    filas = []
    wb = load_workbook(filepath, data_only=True, read_only=True)
    try:
        ws = wb.active
        for row in ws.iter_rows(min_row=7, max_col=8, values_only=True):
            nombre = row[0]
            if not nombre or not str(nombre).strip():
                continue
            filas.append({
                "nombre": str(nombre).strip(),
                "estado": str(row[1]).strip() if row[1] else "Desconocido",
                "categoria_tabla": str(row[2]).strip() if row[2] else "",
                "cant_max_busquedas": row[3] if isinstance(row[3], (int, float)) else 0,
                "fecha_ultima_carga": str(row[4]).strip() if row[4] else None,
                "calidad_datos": str(row[5]).strip() if row[5] else "N.A",
                "motivo_suspension": str(row[6]).strip() if row[6] else None,
                "vencimiento_validacion": str(row[7]).strip() if row[7] else None,
            })
    finally:
        wb.close()
    return filas


def ejecutar_backfill_historico(db: Session) -> dict:
    """
    Reconstruye SnapshotDiario a partir de los backups Excel históricos guardados
    en Backup_Scraping/. Es idempotente: si un día ya tiene snapshots cargados,
    se omite ese archivo completo.
    """
    resultado = {
        "archivos_procesados": 0,
        "archivos_omitidos_ya_procesados": 0,
        "snapshots_insertados": 0,
        "filas_sin_institucion_coincidente": 0,
    }

    if not os.path.isdir(BACKUP_DIR):
        return resultado

    # Mapa de nombre/alias -> institucion para matching rápido
    instituciones = db.query(Institucion).all()
    mapa_nombre = {}
    for inst in instituciones:
        mapa_nombre[inst.nombre.strip().upper()] = inst
        for alias in (inst.alias_nombres or []):
            mapa_nombre[alias.strip().upper()] = inst

    archivos = sorted(
        f for f in os.listdir(BACKUP_DIR)
        if NOMBRE_ARCHIVO_REGEX.search(f)
    )

    for filename in archivos:
        match = NOMBRE_ARCHIVO_REGEX.search(filename)
        anio, mes, dia = (int(x) for x in match.groups())
        try:
            fecha_archivo = date(anio, mes, dia)
        except ValueError:
            continue

        dia_inicio = datetime(anio, mes, dia, 0, 0, 0)
        dia_fin = datetime(anio, mes, dia, 23, 59, 59)

        ya_existe = db.query(SnapshotDiario).filter(
            SnapshotDiario.fecha_snapshot >= dia_inicio,
            SnapshotDiario.fecha_snapshot <= dia_fin,
        ).first()
        if ya_existe:
            resultado["archivos_omitidos_ya_procesados"] += 1
            continue

        filepath = os.path.join(BACKUP_DIR, filename)
        try:
            filas = _leer_backup_excel(filepath)
        except Exception as e:
            logger.error(f"No se pudo leer el backup {filename}: {e}")
            continue

        fecha_snapshot = datetime(anio, mes, dia, 12, 0, 0)
        insertados_archivo = 0

        for fila in filas:
            inst = mapa_nombre.get(fila["nombre"].upper())
            if not inst:
                resultado["filas_sin_institucion_coincidente"] += 1
                continue

            snap = SnapshotDiario(
                institucion_id=inst.id,
                fecha_snapshot=fecha_snapshot,
                estado=fila["estado"][:95],
                cant_max_busquedas=fila["cant_max_busquedas"],
                fecha_ultima_carga=fila["fecha_ultima_carga"][:95] if fila["fecha_ultima_carga"] else None,
                calidad_datos=fila["calidad_datos"][:45] if fila["calidad_datos"] else None,
                motivo_suspension=fila["motivo_suspension"],
                vencimiento_validacion=fila["vencimiento_validacion"][:95] if fila["vencimiento_validacion"] else None,
                categoria_tabla=(fila["categoria_tabla"] or fila["estado"])[:95],
            )
            db.add(snap)
            insertados_archivo += 1

        db.commit()
        resultado["archivos_procesados"] += 1
        resultado["snapshots_insertados"] += insertados_archivo

    return resultado


def _detectar_eventos_carga(snapshots_ordenados: list[tuple[datetime, int, str]]) -> list[dict]:
    """
    Recibe snapshots (fecha_snapshot, cant_max_busquedas, estado) de una institución,
    ORDENADOS ascendentemente por fecha_snapshot, y detecta los eventos reales de carga
    de XML: cada vez que 'Búsquedas Máx.' cambia respecto al snapshot anterior.

    Regla de negocio: la corrida de las 07hs (única que genera estos snapshots) revela
    recién al día siguiente lo que la institución cargó, porque BICSA procesa las cargas
    del día a la medianoche. Por eso el evento se atribuye al día calendario ANTERIOR
    al del snapshot que lo detectó (ej.: si el snapshot del 09/09 muestra un valor nuevo,
    la carga real ocurrió el 08/09).

    Caso especial 1: si el PRIMER snapshot que vemos de una institución la encuentra en
    'Validación de XML', significa que recién se dio de alta y ese número inicial no es
    una carga confirmada (puede ser un valor de referencia asignado al ingresar). Ese
    primer valor se guarda como referencia para detectar cambios futuros, pero no se
    cuenta como evento — así una institución nueva no aparece en los reportes hasta que
    complete una carga real. Si la institución YA tenía historial antes de pasar a
    Validación de XML, esto no aplica (su último evento real sigue siendo válido).

    Caso especial 2: si una institución SALE de 'Validación de XML' hacia cualquier otro
    estado (ej. 'Activa (límite de consultas)') sin que 'Búsquedas Máx.' haya cambiado de
    valor, ese momento igual se cuenta como el primer evento real: el número que era solo
    de referencia queda confirmado en cuanto la institución deja de estar en validación,
    aunque numéricamente sea idéntico al de referencia.
    """
    eventos = []
    valor_anterior = None
    en_validacion_anterior = False
    primer_snapshot = True

    for fecha_snapshot, cant_max, estado in snapshots_ordenados:
        cant_max = cant_max or 0
        en_validacion_actual = _es_validacion_xml(estado)

        if primer_snapshot:
            if not en_validacion_actual:
                fecha_evento = (fecha_snapshot - timedelta(days=1)).date()
                eventos.append({"fecha": fecha_evento, "valor": round(cant_max / 2)})
            valor_anterior = cant_max
            en_validacion_anterior = en_validacion_actual
            primer_snapshot = False
            continue

        cambio_valor = cant_max != valor_anterior
        salio_de_validacion = en_validacion_anterior and not en_validacion_actual

        if cambio_valor or salio_de_validacion:
            fecha_evento = (fecha_snapshot - timedelta(days=1)).date()
            eventos.append({"fecha": fecha_evento, "valor": round(cant_max / 2)})

        valor_anterior = cant_max
        en_validacion_anterior = en_validacion_actual

    return eventos


def _detectar_eventos_carga_por_fecha_xml(
    snapshots_ordenados: list[tuple[datetime, int, str, str | None]]
) -> list[dict]:
    """
    Variante de _detectar_eventos_carga para instituciones en 'Activa (límite de
    consultas)': ahí 'Búsquedas Máx.' es un límite asignado a mano por BICSA (puede
    quedar fijo semanas aunque la institución siga cargando XML normalmente), así que
    detectar cambios de ese valor no sirve para saber cuándo cargaron. La señal real
    es el campo 'Última Carga XML' que informa BICSA: cada vez que esa fecha avanza,
    hubo una carga real ese día, sin importar si el límite asignado cambió.

    Recibe snapshots (fecha_snapshot, cant_max_busquedas, estado, fecha_ultima_carga)
    ordenados ascendentemente y devuelve un evento por cada fecha de 'Última Carga
    XML' distinta que aparece, usando esa fecha tal cual (ya es la fecha real de
    carga informada por BICSA, no hace falta restarle un día). El valor de Búsquedas
    Máx. se incluye solo a título informativo (dividido entre 2, puede no ser exacto).
    """
    eventos = []
    fecha_carga_anterior = None

    for _, cant_max, _estado, fecha_ultima_carga_str in snapshots_ordenados:
        fecha_carga = parse_fecha_bicsa(fecha_ultima_carga_str)
        if fecha_carga is None:
            continue
        fecha_carga_date = fecha_carga.date()
        if fecha_carga_date == fecha_carga_anterior:
            continue
        eventos.append({"fecha": fecha_carga_date, "valor": round((cant_max or 0) / 2)})
        fecha_carga_anterior = fecha_carga_date

    return eventos


def obtener_reporte_cargas_mensuales(db: Session) -> dict:
    """
    Calcula el cierre de carga mensual por institución a partir de los snapshots
    diarios generados EXCLUSIVAMENTE por la corrida FULL de las 07hs (única que
    persiste en SnapshotDiario), detectando cambios reales en 'Búsquedas Máx.'
    (ver _detectar_eventos_carga) y usando ese valor / 2 como cantidad real aportada
    (la política de BICSA duplica ese número respecto de lo efectivamente cargado).

    Excluye instituciones en estado 'Desvinculada' (según su estado actual) y las
    que nunca registraron una carga de XML válida.
    """
    from zoneinfo import ZoneInfo
    try:
        ahora = datetime.now(ZoneInfo("America/Asuncion")).replace(tzinfo=None)
    except Exception:
        ahora = datetime.now()

    mes_en_curso = ahora.strftime("%Y-%m")

    # 1. Instituciones vigentes (con estado actual) y no Desvinculadas. Las que están
    #    en 'Activa (límite de consultas)' se marcan aparte: 'Búsquedas Máx.' ahí es un
    #    límite de consultas asignado a mano por BICSA (no una carga real), pero se las
    #    sigue mostrando con la detección automática (útil para ver en el calendario
    #    cuándo cargan XML) marcadas con una observación, y el cierre manual (cuando se
    #    cargue) reemplaza el valor automático solo en el mes correspondiente.
    estados_actuales = db.query(EstadoActual).join(Institucion).filter(
        ~Institucion.nombre.contains("@")
    ).all()

    ids_permitidos = {}
    ids_limite_consultas = {}
    for e in estados_actuales:
        if _es_desvinculada(e.estado, e.categoria_tabla):
            continue
        ids_permitidos[e.institucion_id] = e.institucion.nombre
        if _es_limite_consultas(e.estado, e.categoria_tabla):
            ids_limite_consultas[e.institucion_id] = e.institucion.nombre

    if not ids_permitidos:
        return {"meses": [], "mes_en_curso": mes_en_curso, "totales_mensuales": [], "instituciones": []}

    # 2. Snapshots oficiales (proceso de 07hs) por institución, ordenados por fecha
    snapshots = db.query(SnapshotDiario).filter(
        SnapshotDiario.institucion_id.in_(list(ids_permitidos.keys()))
    ).order_by(SnapshotDiario.fecha_snapshot.asc()).all()

    snapshots_por_institucion = defaultdict(list)
    for s in snapshots:
        snapshots_por_institucion[s.institucion_id].append((s.fecha_snapshot, s.cant_max_busquedas, s.estado))

    # 3. Detectar eventos de carga reales y construir la serie mensual con
    #    "forward-fill": si un mes no tuvo una carga nueva, se arrastra el último
    #    cierre real conocido (una institución puede tardar 2 o 3 meses en volver
    #    a cargar, por ejemplo mientras está en Validación de XML, y su cierre
    #    debe seguir apareciendo en esos meses intermedios).
    series_por_institucion = defaultdict(list)
    for institucion_id, snaps in snapshots_por_institucion.items():
        eventos = sorted(_detectar_eventos_carga(snaps), key=lambda e: e["fecha"])
        if not eventos:
            continue  # Nunca tuvo una carga real confirmada -> excluida

        eventos_por_mes = {}
        for ev in eventos:
            eventos_por_mes[ev["fecha"].strftime("%Y-%m")] = ev  # se queda el último del mes

        mes_cursor = max(eventos[0]["fecha"].strftime("%Y-%m"), MES_INICIO_HISTORICO)
        valor_actual, fecha_actual = None, None
        while mes_cursor <= mes_en_curso:
            if mes_cursor in eventos_por_mes:
                valor_actual = eventos_por_mes[mes_cursor]["valor"]
                fecha_actual = eventos_por_mes[mes_cursor]["fecha"]
            if valor_actual is not None:
                series_por_institucion[institucion_id].append({
                    "mes": mes_cursor,
                    "valor": valor_actual,
                    "fecha_cierre": fecha_actual.strftime("%d/%m/%Y"),
                })
            mes_cursor = _sumar_meses(mes_cursor, 1)

    instituciones_resultado = []
    instituciones_por_id = {}
    for institucion_id, nombre in ids_permitidos.items():
        cierres = sorted(series_por_institucion.get(institucion_id, []), key=lambda c: c["mes"])
        if not cierres and institucion_id not in ids_limite_consultas:
            continue  # No registra carga -> excluida
        entrada = {
            "institucion_id": institucion_id,
            "nombre": nombre,
            "cierres": cierres,
        }
        if institucion_id in ids_limite_consultas:
            entrada["limite_consultas"] = True
        instituciones_resultado.append(entrada)
        instituciones_por_id[institucion_id] = entrada

    # 4. Instituciones en 'Activa (límite de consultas)': 'Búsquedas Máx.' ahí es un
    #    límite de consultas asignado a mano por BICSA, no una carga real. Cuando hay
    #    un cierre cargado a mano (ver obtener_limite_consultas) para un mes puntual,
    #    ese valor REEMPLAZA al automático de ese mes (sin dividir entre 2); los meses
    #    sin cierre manual siguen mostrando el valor automático, ya marcado con la
    #    observación 'limite_consultas' para que quede claro que puede no ser exacto.
    if ids_limite_consultas:
        manuales = db.query(CierreManualLimiteConsultas).filter(
            CierreManualLimiteConsultas.institucion_id.in_(list(ids_limite_consultas.keys()))
        ).order_by(CierreManualLimiteConsultas.mes.asc()).all()
        manuales_por_institucion = defaultdict(list)
        for m in manuales:
            manuales_por_institucion[m.institucion_id].append(m)

        for institucion_id, registros in manuales_por_institucion.items():
            entrada = instituciones_por_id.get(institucion_id)
            if entrada is None:
                entrada = {
                    "institucion_id": institucion_id,
                    "nombre": ids_limite_consultas[institucion_id],
                    "cierres": [],
                    "limite_consultas": True,
                }
                instituciones_resultado.append(entrada)
                instituciones_por_id[institucion_id] = entrada

            cierres_por_mes = {c["mes"]: c for c in entrada["cierres"]}
            for r in registros:
                cierres_por_mes[r.mes] = {
                    "mes": r.mes,
                    "valor": r.valor,
                    "fecha_cierre": r.actualizado_el.strftime("%d/%m/%Y"),
                    "manual": True,
                }
            entrada["cierres"] = sorted(cierres_por_mes.values(), key=lambda c: c["mes"])

    meses_set = set()
    for inst in instituciones_resultado:
        for c in inst["cierres"]:
            meses_set.add(c["mes"])

    meses_ordenados = sorted(meses_set)

    # 5. Totales mensuales agregados (para el gráfico de tendencia)
    totales_por_mes = {m: {"total": 0, "cantidad_instituciones": 0} for m in meses_ordenados}
    for inst in instituciones_resultado:
        for c in inst["cierres"]:
            totales_por_mes[c["mes"]]["total"] += c["valor"]
            totales_por_mes[c["mes"]]["cantidad_instituciones"] += 1

    totales_mensuales = [
        {"mes": m, "total": totales_por_mes[m]["total"], "cantidad_instituciones": totales_por_mes[m]["cantidad_instituciones"]}
        for m in meses_ordenados
    ]

    instituciones_resultado.sort(key=lambda i: i["nombre"])

    return {
        "meses": meses_ordenados,
        "mes_en_curso": mes_en_curso,
        "totales_mensuales": totales_mensuales,
        "instituciones": instituciones_resultado,
    }


def obtener_historial_cargas_institucion(db: Session, institucion_id: int) -> dict:
    """
    Devuelve, para una institución puntual, cada evento real de carga de XML
    detectado (ver _detectar_eventos_carga) junto con el valor real aportado
    (Búsquedas Máx. / 2). Pensado para alimentar una vista de calendario.
    """
    from zoneinfo import ZoneInfo
    try:
        ahora = datetime.now(ZoneInfo("America/Asuncion")).replace(tzinfo=None)
    except Exception:
        ahora = datetime.now()
    mes_en_curso = ahora.strftime("%Y-%m")

    inst = db.query(Institucion).filter(Institucion.id == institucion_id).first()
    if not inst:
        return {"institucion_id": institucion_id, "nombre": None, "eventos": []}

    estado_actual = db.query(EstadoActual).filter(EstadoActual.institucion_id == institucion_id).first()
    es_limite_consultas = bool(estado_actual and _es_limite_consultas(estado_actual.estado, estado_actual.categoria_tabla))

    snapshots = db.query(SnapshotDiario).filter(
        SnapshotDiario.institucion_id == institucion_id
    ).order_by(SnapshotDiario.fecha_snapshot.asc()).all()

    if es_limite_consultas:
        # 'Búsquedas Máx.' es un límite fijo asignado a mano acá: se usa la fecha real
        # de 'Última Carga XML' para saber cuándo cargaron, en vez de cambios de valor.
        snaps = [(s.fecha_snapshot, s.cant_max_busquedas, s.estado, s.fecha_ultima_carga) for s in snapshots]
        eventos_detectados = _detectar_eventos_carga_por_fecha_xml(snaps)
    else:
        snaps = [(s.fecha_snapshot, s.cant_max_busquedas, s.estado) for s in snapshots]
        eventos_detectados = _detectar_eventos_carga(snaps)
    eventos = [
        {"fecha": ev["fecha"].strftime("%Y-%m-%d"), "valor": ev["valor"]}
        for ev in eventos_detectados
        if MES_INICIO_HISTORICO <= ev["fecha"].strftime("%Y-%m") <= mes_en_curso
    ]

    # Cierres cargados a mano (institución en 'Activa (límite de consultas)'): se
    # muestran con el valor tal cual, SIN dividir entre 2, marcados como "manual".
    manuales = db.query(CierreManualLimiteConsultas).filter(
        CierreManualLimiteConsultas.institucion_id == institucion_id
    ).all()
    for m in manuales:
        eventos.append({
            "fecha": m.actualizado_el.strftime("%Y-%m-%d"),
            "valor": m.valor,
            "manual": True,
            "mes_cerrado": m.mes,
        })
    eventos.sort(key=lambda e: e["fecha"])

    return {
        "institucion_id": institucion_id,
        "nombre": inst.nombre,
        "eventos": eventos,
    }


def obtener_limite_consultas(db: Session) -> dict:
    """
    Instituciones actualmente en 'Activa (límite de consultas)': ese estado significa
    que BICSA les asignó a mano un límite de consultas (a veces 0 para bloquear el
    servicio, a veces ajustado hacia arriba o abajo) que NO refleja su carga real.
    Por eso su cierre mensual se carga a mano en vez de detectarse automáticamente.

    Devuelve, para cada una, los meses ya cargados y los meses pendientes (desde
    MES_INICIO_HISTORICO hasta el último mes ya cerrado, sin contar el mes en curso).
    """
    from zoneinfo import ZoneInfo
    try:
        ahora = datetime.now(ZoneInfo("America/Asuncion")).replace(tzinfo=None)
    except Exception:
        ahora = datetime.now()
    mes_en_curso = ahora.strftime("%Y-%m")
    ultimo_mes_cerrado = _mes_anterior(mes_en_curso)

    estados_actuales = db.query(EstadoActual).join(Institucion).filter(
        ~Institucion.nombre.contains("@")
    ).all()

    instituciones_limite = {}
    for e in estados_actuales:
        if _es_limite_consultas(e.estado, e.categoria_tabla):
            instituciones_limite[e.institucion_id] = {
                "institucion_id": e.institucion_id,
                "nombre": e.institucion.nombre,
                "valor_sistema_actual": e.cant_max_busquedas,
            }

    if not instituciones_limite or ultimo_mes_cerrado < MES_INICIO_HISTORICO:
        return {
            "mes_en_curso": mes_en_curso,
            "ultimo_mes_cerrado": ultimo_mes_cerrado,
            "instituciones": [],
            "total_pendientes": 0,
        }

    manuales = db.query(CierreManualLimiteConsultas).filter(
        CierreManualLimiteConsultas.institucion_id.in_(list(instituciones_limite.keys()))
    ).all()
    manuales_por_institucion = defaultdict(dict)
    for m in manuales:
        manuales_por_institucion[m.institucion_id][m.mes] = {
            "mes": m.mes,
            "valor": m.valor,
            "usuario_email": m.usuario_email,
            "fecha_carga": m.actualizado_el.strftime("%d/%m/%Y %H:%M"),
        }

    meses_a_cubrir = []
    cursor = MES_INICIO_HISTORICO
    while cursor <= ultimo_mes_cerrado:
        meses_a_cubrir.append(cursor)
        cursor = _sumar_meses(cursor, 1)

    total_pendientes = 0
    resultado_instituciones = []
    for institucion_id, info in instituciones_limite.items():
        cargados = manuales_por_institucion.get(institucion_id, {})
        pendientes = [m for m in meses_a_cubrir if m not in cargados]
        total_pendientes += len(pendientes)
        resultado_instituciones.append({
            **info,
            "cierres_cargados": sorted(cargados.values(), key=lambda c: c["mes"]),
            "meses_pendientes": pendientes,
        })

    resultado_instituciones.sort(key=lambda i: (-len(i["meses_pendientes"]), i["nombre"]))

    return {
        "mes_en_curso": mes_en_curso,
        "ultimo_mes_cerrado": ultimo_mes_cerrado,
        "instituciones": resultado_instituciones,
        "total_pendientes": total_pendientes,
    }


def guardar_cierre_manual_limite_consultas(db: Session, institucion_id: int, mes: str, valor: int, usuario_email: str) -> dict:
    if not re.match(r"^\d{4}-\d{2}$", mes or ""):
        raise ValueError("Formato de mes inválido, se espera YYYY-MM.")
    if valor is None or valor < 0:
        raise ValueError("El valor debe ser un número mayor o igual a 0.")

    inst = db.query(Institucion).filter(Institucion.id == institucion_id).first()
    if not inst:
        raise ValueError("Institución no encontrada.")

    registro = db.query(CierreManualLimiteConsultas).filter(
        CierreManualLimiteConsultas.institucion_id == institucion_id,
        CierreManualLimiteConsultas.mes == mes,
    ).first()
    if registro:
        registro.valor = valor
        registro.usuario_email = usuario_email
    else:
        registro = CierreManualLimiteConsultas(
            institucion_id=institucion_id, mes=mes, valor=valor, usuario_email=usuario_email
        )
        db.add(registro)
    db.commit()
    db.refresh(registro)

    return {
        "institucion_id": institucion_id,
        "nombre": inst.nombre,
        "mes": mes,
        "valor": valor,
        "usuario_email": usuario_email,
        "fecha_carga": registro.actualizado_el.strftime("%d/%m/%Y %H:%M"),
    }


MESES_NOMBRE = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _nombre_mes(mes: str) -> str:
    anio, m = (int(x) for x in mes.split("-"))
    return f"{MESES_NOMBRE[m - 1]} {anio}"


def _mes_anterior(mes: str) -> str:
    anio, m = (int(x) for x in mes.split("-"))
    idx = anio * 12 + (m - 1) - 1
    return f"{idx // 12:04d}-{(idx % 12) + 1:02d}"


def _calcular_filas_mes(reporte: dict, mes: str) -> list[dict]:
    """
    A partir del reporte completo (obtener_reporte_cargas_mensuales), arma la
    lista 'Detalle por Institución' para un mes puntual: valor actual, fecha de
    cierre, valor del mes anterior y variación. Misma lógica que usa el frontend
    para la tabla de detalle, centralizada acá para reutilizarla en la exportación.
    """
    mes_anterior = _mes_anterior(mes)
    filas = []
    for inst in reporte["instituciones"]:
        cierres_por_mes = {c["mes"]: c for c in inst["cierres"]}
        actual = cierres_por_mes.get(mes)
        if not actual:
            continue
        anterior = cierres_por_mes.get(mes_anterior)
        variacion_abs = (actual["valor"] - anterior["valor"]) if anterior else None
        variacion_pct = (
            round((variacion_abs / anterior["valor"]) * 100, 2)
            if (anterior and anterior["valor"])
            else None
        )
        filas.append({
            "nombre": inst["nombre"],
            "valor_actual": actual["valor"],
            "fecha_cierre": actual["fecha_cierre"],
            "valor_anterior": anterior["valor"] if anterior else None,
            "variacion_abs": variacion_abs,
            "variacion_pct": variacion_pct,
            "limite_consultas": bool(inst.get("limite_consultas")),
            "manual": bool(actual.get("manual")),
        })

    filas.sort(key=lambda f: f["valor_actual"], reverse=True)
    return filas


def generar_excel_cargas_mensuales(filas: list[dict], mes: str) -> io.BytesIO:
    """
    Genera un Excel estilizado con el detalle de cierre de carga mensual por
    institución (mismo criterio visual que generar_excel_instituciones).
    """
    mes_anterior = _mes_anterior(mes)

    wb = Workbook()
    ws = wb.active
    ws.title = "Cierre de Carga Mensual"
    ws.views.sheetView[0].showGridLines = True

    NAVY_HEADER = "1E293B"
    WHITE_TEXT = "FFFFFF"
    BORDER_COLOR = "CBD5E1"

    FILL_SUBE = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    FONT_SUBE = Font(name="Calibri", size=10, bold=True, color="166534")

    FILL_BAJA = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    FONT_BAJA = Font(name="Calibri", size=10, bold=True, color="991B1B")

    FILL_NEUTRO = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    FONT_NEUTRO = Font(name="Calibri", size=10, color="475569")

    font_title = Font(name="Calibri", size=16, bold=True, color="0F172A")
    font_subtitle = Font(name="Calibri", size=10, italic=True, color="64748B")
    font_header = Font(name="Calibri", size=11, bold=True, color=WHITE_TEXT)
    font_cell = Font(name="Calibri", size=10, color="0F172A")
    font_bold = Font(name="Calibri", size=10, bold=True, color="0F172A")

    thin_border = Border(
        left=Side(style="thin", color=BORDER_COLOR),
        right=Side(style="thin", color=BORDER_COLOR),
        top=Side(style="thin", color=BORDER_COLOR),
        bottom=Side(style="thin", color=BORDER_COLOR),
    )

    ws.merge_cells("A1:F1")
    ws["A1"] = f"CIERRE DE CARGA MENSUAL POR INSTITUCIÓN - {_nombre_mes(mes).upper()}"
    ws["A1"].font = font_title

    ws.merge_cells("A2:F2")
    ws["A2"] = (
        f"Reporte generado el {datetime.now().strftime('%d/%m/%Y a las %H:%M:%S')}. "
        f"Cantidad real aportada (Búsquedas Máx. ÷ 2). Comparado contra {_nombre_mes(mes_anterior)}."
    )
    ws["A2"].font = font_subtitle

    headers = [
        "Institución",
        f"Cierre {_nombre_mes(mes)}",
        "Fecha de Cierre",
        f"Cierre {_nombre_mes(mes_anterior)}",
        "Variación",
        "% Variación",
    ]
    row_idx = 4
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=header)
        cell.font = font_header
        cell.fill = PatternFill(start_color=NAVY_HEADER, end_color=NAVY_HEADER, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[row_idx].height = 26

    row_idx = 5
    for fila in filas:
        nombre_celda = fila["nombre"]
        if fila.get("manual"):
            nombre_celda += " [CIERRE MANUAL]"
        elif fila.get("limite_consultas"):
            nombre_celda += " [⚠ LÍMITE CONSULTAS]"
        ws.cell(row=row_idx, column=1, value=nombre_celda).font = font_bold

        c_actual = ws.cell(row=row_idx, column=2, value=fila["valor_actual"])
        c_actual.font = font_cell
        c_actual.number_format = "#,##0"
        c_actual.alignment = Alignment(horizontal="right")

        ws.cell(row=row_idx, column=3, value=fila["fecha_cierre"]).font = font_cell
        ws.cell(row=row_idx, column=3).alignment = Alignment(horizontal="center")

        c_anterior = ws.cell(row=row_idx, column=4, value=fila["valor_anterior"] if fila["valor_anterior"] is not None else "Sin datos")
        c_anterior.font = font_cell
        c_anterior.alignment = Alignment(horizontal="right" if fila["valor_anterior"] is not None else "center")
        if fila["valor_anterior"] is not None:
            c_anterior.number_format = "#,##0"

        c_var = ws.cell(row=row_idx, column=5, value=fila["variacion_abs"] if fila["variacion_abs"] is not None else "-")
        c_pct = ws.cell(row=row_idx, column=6, value=(fila["variacion_pct"] / 100) if fila["variacion_pct"] is not None else "-")
        for c in (c_var, c_pct):
            c.alignment = Alignment(horizontal="center")

        if fila["variacion_abs"] is None:
            for c in (c_var, c_pct):
                c.fill = FILL_NEUTRO
                c.font = FONT_NEUTRO
        elif fila["variacion_abs"] > 0:
            c_var.number_format = "+#,##0;-#,##0"
            c_pct.number_format = "+0.00%;-0.00%"
            for c in (c_var, c_pct):
                c.fill = FILL_SUBE
                c.font = FONT_SUBE
        elif fila["variacion_abs"] < 0:
            c_var.number_format = "+#,##0;-#,##0"
            c_pct.number_format = "+0.00%;-0.00%"
            for c in (c_var, c_pct):
                c.fill = FILL_BAJA
                c.font = FONT_BAJA
        else:
            for c in (c_var, c_pct):
                c.fill = FILL_NEUTRO
                c.font = FONT_NEUTRO

        for col_idx in range(1, 7):
            ws.cell(row=row_idx, column=col_idx).border = thin_border

        row_idx += 1

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)
    ws.column_dimensions["A"].width = 42

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


MESES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


def _calcular_matriz_anual(reporte: dict, anio: str) -> list[dict]:
    """
    Arma, para cada institución, los 12 cierres mensuales del año solicitado
    (o None si no registró carga ese mes), junto con la tendencia respecto al
    mes anterior (incluyendo diciembre del año previo para comparar enero).
    """
    filas = []
    for inst in reporte["instituciones"]:
        por_mes = {c["mes"]: c for c in inst["cierres"]}
        valores = []
        tiene_dato = False
        for m in range(1, 13):
            clave = f"{anio}-{m:02d}"
            if m == 1:
                clave_anterior = f"{int(anio) - 1:04d}-12"
            else:
                clave_anterior = f"{anio}-{m - 1:02d}"
            valor = por_mes.get(clave, {}).get("valor")
            valor_anterior = por_mes.get(clave_anterior, {}).get("valor")
            tendencia = None
            if valor is not None and valor_anterior is not None:
                tendencia = "sube" if valor > valor_anterior else "baja" if valor < valor_anterior else "igual"
            if valor is not None:
                tiene_dato = True
            valores.append({
                "valor": valor,
                "tendencia": tendencia,
                "manual": bool(por_mes.get(clave, {}).get("manual")),
            })
        if tiene_dato:
            filas.append({"nombre": inst["nombre"], "valores": valores, "limite_consultas": bool(inst.get("limite_consultas"))})

    filas.sort(key=lambda f: f["nombre"])
    return filas


def generar_excel_vista_anual(filas: list[dict], anio: str) -> io.BytesIO:
    """
    Genera un Excel estilizado con la vista anual (Institución x 12 meses) de
    cierres de carga, con el mismo criterio visual profesional del reporte mensual.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Vista Anual {anio}"
    ws.views.sheetView[0].showGridLines = True

    NAVY_HEADER = "1E293B"
    WHITE_TEXT = "FFFFFF"
    BORDER_COLOR = "CBD5E1"

    FILL_SUBE = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    FONT_SUBE = Font(name="Calibri", size=10, bold=True, color="166534")

    FILL_BAJA = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    FONT_BAJA = Font(name="Calibri", size=10, bold=True, color="991B1B")

    FILL_MANUAL = PatternFill(start_color="EDE9FE", end_color="EDE9FE", fill_type="solid")
    FONT_MANUAL = Font(name="Calibri", size=10, bold=True, color="5B21B6")

    FILL_LIMITE = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    FONT_LIMITE = Font(name="Calibri", size=10, color="92400E")

    font_title = Font(name="Calibri", size=16, bold=True, color="0F172A")
    font_subtitle = Font(name="Calibri", size=10, italic=True, color="64748B")
    font_header = Font(name="Calibri", size=11, bold=True, color=WHITE_TEXT)
    font_cell = Font(name="Calibri", size=10, color="0F172A")
    font_cell_sin_datos = Font(name="Calibri", size=10, color="94A3B8")
    font_bold = Font(name="Calibri", size=10, bold=True, color="0F172A")

    thin_border = Border(
        left=Side(style="thin", color=BORDER_COLOR),
        right=Side(style="thin", color=BORDER_COLOR),
        top=Side(style="thin", color=BORDER_COLOR),
        bottom=Side(style="thin", color=BORDER_COLOR),
    )

    ultima_col_letter = get_column_letter(1 + len(MESES_ABREV))
    ws.merge_cells(f"A1:{ultima_col_letter}1")
    ws["A1"] = f"VISTA ANUAL DE CIERRES POR INSTITUCIÓN - {anio}"
    ws["A1"].font = font_title

    ws.merge_cells(f"A2:{ultima_col_letter}2")
    ws["A2"] = (
        f"Reporte generado el {datetime.now().strftime('%d/%m/%Y a las %H:%M:%S')}. "
        f"Cierre real aportado (Búsquedas Máx. ÷ 2) por mes calendario. Verde/rojo indican suba o baja respecto al mes anterior."
    )
    ws["A2"].font = font_subtitle

    headers = ["Institución"] + MESES_ABREV
    row_idx = 4
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=header)
        cell.font = font_header
        cell.fill = PatternFill(start_color=NAVY_HEADER, end_color=NAVY_HEADER, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[row_idx].height = 24

    row_idx = 5
    for fila in filas:
        nombre_celda = fila["nombre"]
        if fila.get("limite_consultas"):
            nombre_celda += " [⚠ LÍMITE CONSULTAS]"
        ws.cell(row=row_idx, column=1, value=nombre_celda).font = font_bold
        for idx, v in enumerate(fila["valores"]):
            col_idx = idx + 2
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.alignment = Alignment(horizontal="center")
            if v["valor"] is None:
                cell.value = "-"
                cell.font = font_cell_sin_datos
            else:
                cell.value = v["valor"]
                cell.number_format = "#,##0"
                if v.get("manual"):
                    cell.font = FONT_MANUAL
                    cell.fill = FILL_MANUAL
                elif fila.get("limite_consultas"):
                    cell.font = FONT_LIMITE
                    cell.fill = FILL_LIMITE
                elif v["tendencia"] == "sube":
                    cell.font = FONT_SUBE
                    cell.fill = FILL_SUBE
                elif v["tendencia"] == "baja":
                    cell.font = FONT_BAJA
                    cell.fill = FILL_BAJA
                else:
                    cell.font = font_cell
        for col_idx in range(1, len(headers) + 1):
            ws.cell(row=row_idx, column=col_idx).border = thin_border
        row_idx += 1

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)
    ws.column_dimensions["A"].width = 42

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
