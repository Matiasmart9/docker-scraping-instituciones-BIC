# Documentación Arquitectónica - Portal Satélite BICSA V1.7

## 1. Visión General
La V1.7 agrega dos KPI nuevos:
- **Cierre de Carga Mensual** (secciones 2-7): un panel (Menú → "Cierre de Carga Mensual") pensado para reemplazar la verificación manual que hacía el equipo para saber cuánto cargó cada institución por mes y cómo varió respecto al mes anterior. Toma como única fuente los snapshots diarios generados por el proceso **FULL de las 07hs**, ya que las cargas de XML del día recién se procesan a medianoche en BICSA y se hacen visibles al día siguiente.
- **Altas y Bajas de Instituciones por Mes** (sección 8): un panel (Menú → "Altas y Bajas Mes") que detecta automáticamente instituciones nuevas y desvinculadas, sin necesidad de ningún backfill.

## 2. Flujo de Datos
1. **Snapshot diario (07hs)**: `sync.py` sigue guardando en `snapshot_diario` la foto de cada institución únicamente en las corridas `FULL` (las corridas `LIGHT` de las 16hs no participan de este KPI).
2. **Detección de eventos de carga** (`_detectar_eventos_carga` en `backend/app/services/kpi_cargas.py`): se recorren los snapshots de una institución ordenados por fecha y se registra un evento cada vez que cambia `Búsquedas Máx.` respecto al snapshot anterior.
   - El evento se atribuye al **día calendario anterior** al del snapshot que lo detectó (si el snapshot del 09/09 revela un valor nuevo, la carga real ocurrió el 08/09).
   - El valor real aportado es `Búsquedas Máx. ÷ 2` (la política de BICSA duplica ese número respecto de lo efectivamente cargado).
   - Si el **primer snapshot** que se ve de una institución la encuentra en **"Validación de XML"**, ese número no se cuenta como carga confirmada (puede ser un valor de referencia asignado al ingresar). Evita que una institución recién dada de alta aparezca en los reportes sin haber cargado nunca.
3. **Cierre mensual con forward-fill**: para cada institución se arma la serie mes a mes desde su primera carga real hasta el mes en curso. Si un mes no tuvo carga nueva, se **arrastra el último cierre real conocido** (ej. una institución que pasa varios meses en Validación de XML sigue apareciendo en el reporte con su último número confirmado, en vez de desaparecer).
4. **Piso histórico**: `MES_INICIO_HISTORICO` (actualmente `"2026-08"`) descarta cualquier dato anterior a ese mes, evitando arrastrar fechas corruptas del portal de origen. Se ajusta si en algún ambiente el histórico real de `snapshot_diario` arranca antes.
5. **Exclusiones**: quedan fuera del reporte las instituciones en estado **Desvinculada** y las que nunca registraron una carga real confirmada. Las instituciones en **"Activa (límite de consultas)"** NO se excluyen — ver sección 7.

## 3. Backfill Histórico
`ejecutar_backfill_historico` reconstruye `snapshot_diario` a partir de los backups Excel guardados en `Backup_Scraping/` (generados automáticamente en cada sincronización). Es idempotente — si un día ya tiene snapshots cargados, se omite ese archivo. Se ejecuta automáticamente cada vez que se abre el panel, así el histórico se completa solo aunque falten días puntuales.

## 4. Endpoints Nuevos (`/api/v1/kpi-cargas`)
- `GET /mensual`: serie de cierres por institución y totales agregados por mes.
- `GET /mensual/exportar-excel?mes=YYYY-MM`: exporta el detalle del mes seleccionado a Excel con formato profesional (colores según suba/baja, y marcas de cierre manual / límite de consultas — ver sección 7).
- `GET /anual/exportar-excel?anio=YYYY`: exporta la matriz institución × 12 meses del año seleccionado, con el mismo esquema de colores.
- `GET /institucion/{id}/historial`: eventos de carga individuales de una institución, usados en la vista de calendario.
- `GET /limite-consultas`: instituciones actualmente en "Activa (límite de consultas)", con sus cierres manuales ya cargados y los meses pendientes de cargar.
- `POST /limite-consultas/cargar`: guarda (o actualiza) el cierre manual de una institución para un mes puntual (`institucion_id`, `mes`, `valor`).
- `POST /backfill-historico` (solo administradores): dispara la reconstrucción del histórico desde `Backup_Scraping/`.

## 5. Vista Anual
Matriz Institución × 12 meses con filtro de año (se puebla dinámicamente a partir de los meses que realmente tienen datos, por lo que un año nuevo aparece solo sin cambios de código). Incluye una tarjeta **"Total de Personas"** con el total agregado al último mes con datos del año seleccionado, marcado como "Cierre definitivo del año" una vez que diciembre queda confirmado, o "Parcial (año en curso)" mientras tanto.

## 6. Otras Mejoras de la V1.7
- Calendario de cargas por institución (clic en el nombre desde cualquiera de las dos vistas).
- Corrección de contraste del menú principal (bug de nombre de variable CSS) y de los encabezados sticky en tema claro.
- Bloqueo de scroll del `body` al abrir estos paneles, con soporte para modales anidados (calendario dentro del panel mensual), vía `frontend/src/scrollLock.js` (conteo de referencias).
- Gráfico "Tendencia Total Aportado": el eje Y tiene ancho fijo (`width={75}`) para que los montos grandes (millones) no queden recortados.

## 7. Instituciones en "Activa (límite de consultas)"
Un grupo de ~10 instituciones (ej. INNOVANET, AJECA, ALIANZA FIEL) tiene un tratamiento especial porque, en ese estado, **"Búsquedas Máx." no es su carga real**: es un límite de consultas que BICSA les asigna **a mano** (a veces 0, para bloquear el servicio por falta de pago; a veces ajustado hacia arriba o abajo según necesidad), totalmente independiente de cuánto XML suban en realidad.

### 7.1. En Cierre Mensual y Vista Anual
Estas instituciones **no se excluyen** del reporte — se muestran con la detección automática normal (útil para ver, por ejemplo, en el calendario cuándo cargaron XML realmente), pero cada fila/celda que use el valor automático se marca con una observación:
- Badge/celda **ámbar "⚠ LÍMITE"**: el valor viene de Búsquedas Máx. ÷ 2 y puede no reflejar la carga real de ese mes.
- Badge/celda **azul "MANUAL"** (con ícono de candado): existe un cierre cargado a mano para ese mes puntual (ver 7.2), que **reemplaza** al valor automático solo en ese mes — el resto de los meses de la misma institución sigue mostrando el valor automático marcado como ⚠ hasta que también se cargue su cierre manual.

Esta misma lógica de colores se replica en los exports a Excel (`generar_excel_cargas_mensuales` / `generar_excel_vista_anual`): relleno ámbar (`FEF3C7`) para valores automáticos sin confirmar y azul (`DBEAFE`) para cierres manuales confirmados, además del sufijo `[⚠ LÍMITE CONSULTAS]` / `[CIERRE MANUAL]` en el nombre de la institución.

### 7.2. Carga manual del cierre real
Pestaña dedicada "Activa (Límite Consultas)" (junto a "Cierre Mensual" / "Vista Anual") donde el equipo carga el cierre real de cada mes para estas instituciones, con el valor final tal cual (**sin dividir entre 2**). Persiste en la tabla `cierre_manual_limite_consultas` (`institucion_id` + `mes` únicos). Un badge con contador de "meses pendientes" (desde `MES_INICIO_HISTORICO` hasta el último mes ya cerrado) avisa cuando falta cargar algún cierre, y desaparece una vez que todos están al día.

### 7.3. Calendario: fecha real de XML en vez de cambios de límite
Como "Búsquedas Máx." puede quedar fijo semanas enteras aunque la institución siga cargando XML con normalidad, usar los cambios de ese valor (como hace `_detectar_eventos_carga` para el resto de instituciones) para pintar el calendario dejaba afuera cargas reales. Para estas instituciones puntualmente, `obtener_historial_cargas_institucion` usa en cambio `_detectar_eventos_carga_por_fecha_xml`: cada vez que el campo **"Última Carga XML"** informado por BICSA avanza a una fecha nueva, se registra ese día como carga real en el calendario (el valor de Búsquedas Máx. se muestra solo a título informativo). El resto de las instituciones sigue con la detección por cambio de valor, sin cambios.

Los cierres manuales, en el calendario, se ubican siempre en el **último día calendario del mes que cierran** (ej. el cierre de Agosto se marca el 31/08), independientemente de qué día se haya cargado a mano — así el mes correspondiente siempre muestra su cierre real al revisarlo, sin importar cuándo se tipeó.

## 8. Altas y Bajas de Instituciones por Mes
Panel (Menú → "Altas y Bajas Mes", ubicado justo después de "Cierre de Carga Mensual") que detecta instituciones que **ingresan** o **se desvinculan** del sistema, mes a mes. A diferencia del KPI de cargas, no necesita ningún backfill: se apoya en datos que el scraper ya escribe en cada corrida, así que funciona "hacia adelante" desde el momento en que se implementó, y hacia atrás para todo lo que ya estaba registrado.

### 8.1. Detección de bajas
Usa la tabla `HistorialCambios` (`backend/app/models/institucion.py`), que el scraper llena automáticamente cada vez que detecta un cambio de estado (`sync.py`, función `sync_scrape_data`). Se filtran los registros cuyo `estado_nuevo` contiene "DESVINCULAD", sin importar desde qué estado venía la institución.

### 8.2. Detección de altas
Usa `Institucion.creado_el`, que SQLAlchemy fija automáticamente al crear una fila nueva — es decir, la primera vez que el scraper ve un nombre que no coincide con ninguna institución existente ni con sus alias registrados (`Institucion.alias_nombres`, usado para manejar cambios de nombre sin crear duplicados).

### 8.3. Filtro de ruido de inicialización
Al revisar los datos reales se encontró que el día en que arrancó el sistema (siembra inicial de ~215 instituciones) generó cientos de "altas" y "bajas" de golpe el mismo día — ruido de inicialización, no movimientos reales. Un día real de operación nunca da de alta o de baja tantas instituciones a la vez, así que `backend/app/services/kpi_movimientos.py` descarta cualquier día calendario con más de `UMBRAL_DIA_MASIVO` (20) movimientos del mismo tipo antes de agrupar por mes.

### 8.4. Endpoints (`/api/v1/kpi-movimientos`)
- `GET /bajas/anual?anio=YYYY`: instituciones desvinculadas del año pedido, agrupadas en los 12 meses (con conteo por mes aunque no haya datos), más el detalle de cada una (nombre, fecha, estado anterior, última carga XML vigente o "Sin Datos" si nunca cargó).
- `GET /bajas/exportar-excel?anio=YYYY`: exporta ese detalle a Excel con estilo profesional.
- `GET /altas/anual?anio=YYYY`: mismo esquema para instituciones nuevas (nombre, fecha de alta, estado actual).
- `GET /altas/exportar-excel?anio=YYYY`: exporta ese detalle a Excel.

El año seleccionable se arma dinámicamente a partir de los años que realmente tienen datos (unión de altas y bajas) más el año en curso, igual que en Vista Anual — un año nuevo aparece sin cambios de código.

### 8.5. Interfaz
Un único panel (`frontend/src/MovimientosInstitucionesModal.jsx`) con: selector de año, gráfico de barras combinado (altas en verde, bajas en naranja) para los 12 meses del año seleccionado, y dos pestañas — "Bajas (Desvinculadas)" y "Altas (Nuevas)" — cada una con su propia tabla de detalle, buscador y botón de exportación a Excel independiente.
