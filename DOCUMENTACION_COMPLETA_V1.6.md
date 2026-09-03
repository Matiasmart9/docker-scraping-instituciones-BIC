# Documentación Arquitectónica - Portal Satélite BICSA V1.6

## 1. Visión General
El Portal Satélite V1.6 es un sistema integral de auditoría de instituciones. A diferencia de las versiones iniciales que solo hacían _scraping_ crudo, esta versión implementa **Persistencia Inteligente de Datos** y **Resolución de Nombres**, asegurando que el historial de una institución nunca se pierda aunque esta cambie su razón social en la fuente original.

## 2. Flujo de Datos Principal
1. **Scraper (Python/Playwright)**: Se ejecuta a las 07:00 (Full) y 16:00 (Light). Extrae la tabla en ASP.NET.
2. **Sincronización (Backend/FastAPI)**:
   - Las instituciones nuevas se agregan.
   - Las que **ya no están** en la extracción se marcan automáticamente como *Desaparecidas* (su `EstadoActual` se borra, pero su `Institucion` base y el historial prevalecen).
   - Se actualizan los KPIs y niveles de alerta en tiempo real.
3. **Resolución de Nombres (UI)**:
   - El administrador entra a `Resolución de Nombres` (Notificación roja en el Menú).
   - Selecciona la institución desaparecida (Ej. `CASA KILA`) y la asocia a su nuevo nombre (Ej. `KILA ELECTRODOMESTICOS EAS`).
   - El backend transfiere `HistorialCambios`, `SnapshotDiario` y `telefonos_contacto`.
   - Se genera una auditoría en la tabla `registro_unificacion`.

## 3. Modelo de Base de Datos Crítico
- `instituciones`: Catálogo principal. (Agregado `alias_nombres` tipo `VARCHAR[]`).
- `estado_actual`: Snapshot intradía. (1 a 1 con Institución). Si no existe, la institución se considera "Desaparecida".
- `registro_unificacion` **[NUEVA V1.6]**: Guarda el rastro inmutable de quién, cuándo y qué se fusionó.

## 4. Control de Acceso (RBAC)
- Todas las rutas están protegidas por Firebase JWT.
- Las funciones de borrado, recálculo y **unificación** validan la bandera `es_admin = True` del usuario local mapeado por Firebase.
