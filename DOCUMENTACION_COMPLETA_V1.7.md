# Documentación Arquitectónica - Portal Satélite BICSA V1.7

## 1. Visión General
La V1.7 agrega un KPI de **Cierre de Carga Mensual**: un panel (Menú → "Cierre de Carga Mensual") pensado para reemplazar la verificación manual que hacía el equipo para saber cuánto cargó cada institución por mes y cómo varió respecto al mes anterior. Toma como única fuente los snapshots diarios generados por el proceso **FULL de las 07hs**, ya que las cargas de XML del día recién se procesan a medianoche en BICSA y se hacen visibles al día siguiente.

## 2. Flujo de Datos
1. **Snapshot diario (07hs)**: `sync.py` sigue guardando en `snapshot_diario` la foto de cada institución únicamente en las corridas `FULL` (las corridas `LIGHT` de las 16hs no participan de este KPI).
2. **Detección de eventos de carga** (`_detectar_eventos_carga` en `backend/app/services/kpi_cargas.py`): se recorren los snapshots de una institución ordenados por fecha y se registra un evento cada vez que cambia `Búsquedas Máx.` respecto al snapshot anterior.
   - El evento se atribuye al **día calendario anterior** al del snapshot que lo detectó (si el snapshot del 09/09 revela un valor nuevo, la carga real ocurrió el 08/09).
   - El valor real aportado es `Búsquedas Máx. ÷ 2` (la política de BICSA duplica ese número respecto de lo efectivamente cargado).
   - Si el **primer snapshot** que se ve de una institución la encuentra en **"Validación de XML"**, ese número no se cuenta como carga confirmada (puede ser un valor de referencia asignado al ingresar). Evita que una institución recién dada de alta aparezca en los reportes sin haber cargado nunca.
3. **Cierre mensual con forward-fill**: para cada institución se arma la serie mes a mes desde su primera carga real hasta el mes en curso. Si un mes no tuvo carga nueva, se **arrastra el último cierre real conocido** (ej. una institución que pasa varios meses en Validación de XML sigue apareciendo en el reporte con su último número confirmado, en vez de desaparecer).
4. **Piso histórico**: `MES_INICIO_HISTORICO` (actualmente `"2026-08"`) descarta cualquier dato anterior a ese mes, evitando arrastrar fechas corruptas del portal de origen. Se ajusta si en algún ambiente el histórico real de `snapshot_diario` arranca antes.
5. **Exclusiones**: quedan fuera del reporte las instituciones en estado **Desvinculada** y las que nunca registraron una carga real confirmada.

## 3. Backfill Histórico
`ejecutar_backfill_historico` reconstruye `snapshot_diario` a partir de los backups Excel guardados en `Backup_Scraping/` (generados automáticamente en cada sincronización). Es idempotente — si un día ya tiene snapshots cargados, se omite ese archivo. Se ejecuta automáticamente cada vez que se abre el panel, así el histórico se completa solo aunque falten días puntuales.

## 4. Endpoints Nuevos (`/api/v1/kpi-cargas`)
- `GET /mensual`: serie de cierres por institución y totales agregados por mes.
- `GET /mensual/exportar-excel?mes=YYYY-MM`: exporta el detalle del mes seleccionado a Excel con formato profesional (colores según suba/baja).
- `GET /anual/exportar-excel?anio=YYYY`: exporta la matriz institución × 12 meses del año seleccionado.
- `GET /institucion/{id}/historial`: eventos de carga individuales de una institución, usados en la vista de calendario.
- `POST /backfill-historico` (solo administradores): dispara la reconstrucción del histórico desde `Backup_Scraping/`.

## 5. Vista Anual
Matriz Institución × 12 meses con filtro de año (se puebla dinámicamente a partir de los meses que realmente tienen datos, por lo que un año nuevo aparece solo sin cambios de código). Incluye una tarjeta **"Total de Personas"** con el total agregado al último mes con datos del año seleccionado, marcado como "Cierre definitivo del año" una vez que diciembre queda confirmado, o "Parcial (año en curso)" mientras tanto.

## 6. Otras Mejoras de la V1.7
- Calendario de cargas por institución (clic en el nombre desde cualquiera de las dos vistas).
- Corrección de contraste del menú principal (bug de nombre de variable CSS).
- Bloqueo de scroll del `body` al abrir estos paneles, con soporte para modales anidados (calendario dentro del panel mensual).
