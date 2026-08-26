# Proyecto: Portal Satélite de Monitoreo de Estado de Instituciones (BICSA)

## Contexto y objetivo

Soy usuario final (con login/contraseña) de un portal web de terceros llamado **BICSA**
(`https://bicquerywebapp.azurewebsites.net`), un sistema ASP.NET WebForms al que **no tengo
acceso de backend/código/base de datos**, solo acceso vía navegador con mi usuario y
contraseña.

Dentro del portal, en `GESTIÓN > Estado Instituciones`
(`Instituciones_Estado.aspx`), hay una pantalla que lista instituciones financieras
agrupadas en distintas tablas por estado:

- **Activa**
- **Suspendida** (con columna "Motivo Suspensión")
- **Bloqueada**
- **Con excepción de carga**
- **Desvinculada**
- **Validación de XML** (con columna "Vencimiento Etapa de Validación")
- **Activa (límite de consultas)**

Columnas comunes: `Nombre Institución`, `Estado`, `Cant. Máx. Búsquedas`,
`Fecha última carga`, `Calidad de Datos Aportados` (Alta/Baja/N.A).

Como **no puedo modificar el sistema de BICSA**, la solución es construir un
**sistema satélite externo, de solo lectura**, que:

1. Se loguea automáticamente al portal con mis credenciales.
2. Extrae (scraping) los datos de la pantalla de Estado de Instituciones.
3. Guarda un histórico propio en base de datos.
4. Expone un **dashboard profesional** (KPIs, gráficos, tabla filtrable, alertas).
5. Permite **exportar a Excel** el estado de las instituciones.

⚠️ Importante: este sistema **NO puede cambiar el estado real** de ninguna institución
en BICSA — eso lo decide el sistema original con su propia lógica interna. Este proyecto
es un **espejo/monitor**, no un actor sobre el sistema fuente.

---

## Reglas de negocio conocidas (lógica interna de BICSA, para referencia — NO se implementa,
solo sirve para interpretar y explicar los datos en el dashboard)

- El proceso de BICSA corre **24/7, una vez por noche a las 00hs**.
- Una institución **Activa** pasa a **Bloqueada** si transcurren **72 horas hábiles**
  (lunes a viernes, sin contar sábados/domingos) sin una nueva carga de XML.
- Cuando una institución bloqueada/en excepción **carga su XML**, pasa a
  **"Con excepción de carga"** momentáneamente, y **al proceso nocturno siguiente (00hs)**
  pasa automáticamente a **Activa**.
- **"Con excepción de carga"** también aparece cuando una institución nueva realiza
  su **primera carga a producción** (entra en flujo de validación).
- **"Validación de XML"** es una etapa previa/paralela con fecha de vencimiento propia.
- Estos cambios de estado son controlados enteramente por BICSA; nuestro sistema solo
  los **observa y registra**.

---

## Frecuencia de scraping (definida)

- **07:00 hs — todos los días** (el proceso nocturno de BICSA corre 24/7):
  Corrida **completa** → genera el snapshot oficial del día, se compara contra el
  snapshot anterior y se registra cada cambio de estado en un log histórico.
- **16:00 hs — lunes a viernes** (configurable a todos los días):
  Corrida **liviana** → solo refresca el estado "en vivo" para detectar cambios
  intradía (ej. una carga de XML que dispara "Con excepción de carga" en el momento).
  No genera un nuevo registro histórico "oficial", solo actualiza la vista actual.

Ambas corridas deben ser configurables vía cron/variables de entorno (horarios,
días de la semana).

---

## Arquitectura técnica

### Entorno de desarrollo
- Windows 11 + VSCode + Docker Desktop.
- Carpeta del proyecto: `C:\Users\Soporte Tecnico\docker-portal-estado-institucionesBIC`
- **Desarrollo Local:** Dado que el `docker-compose.yml` base está optimizado para producción con Coolify (Traefik) y omite los mapeos de puertos expuestos al host, se utiliza un archivo `docker-compose.override.yml` (ignorado en Git) exclusivo para la máquina local. Este archivo restaura el mapeo del puerto `3000:80` para el frontend y simula la red `coolify`, permitiendo el acceso local en `http://localhost:3000`.

### Entorno de producción
- VM propia en **Oracle Cloud (Oracle Cloud Free Tier - Ampere A1)**.
- SO: **Ubuntu 22.04.5**, arquitectura **ARM64 (aarch64)**.
- **Coolify + Traefik Proxy:** El servidor ejecuta Coolify en producción. El tráfico web se enruta a través de Traefik, el cual genera automáticamente certificados Let's Encrypt (HTTPS) para el dominio mapeado en DuckDNS (`bicsa-panel-estado-inst.duckdns.org`).
- **Networking Iptables:** Debido a restricciones nativas de Ubuntu en Oracle Cloud, se agregó una regla `iptables -I FORWARD -j ACCEPT` para permitir el acceso a internet saliente de los contenedores Docker (necesario para la validación SSL).
- **Puertos cerrados:** Por seguridad, todos los puertos internos (`8000`, `8001`, `5432`) están expuestos únicamente hacia la red local `127.0.0.1` o integrados exclusivamente en la red interna de Docker (`coolify` y `default`), evitando exposición pública.

### Implicancia clave: multi-arquitectura
Las imágenes Docker deben buildearse para **linux/amd64** (desarrollo en Windows) y **linux/arm64** (producción en Oracle), usando `docker buildx` con soporte multi-plataforma.

### Stack propuesto
- **Scraper/Login**: Python + Playwright (headless Chromium), porque el portal
  es ASP.NET WebForms (maneja ViewState/sesión), y automatizar con navegador real
  es más robusto que requests HTTP directos.
- **Base de datos**: PostgreSQL (contenedor propio, con volumen persistente).
- **Backend/API**: Python (FastAPI) para exponer los datos al dashboard y generar
  el Excel.
- **Excel export**: librería tipo `openpyxl` o `pandas.to_excel`.
- **Scheduler**: cron dentro de un contenedor dedicado (o cron del sistema en la
  VM) disparando el scraper a las 07:00 y 16:00.
- **Dashboard**: frontend web con gráficos (KPIs por estado, evolución histórica,
  alertas de instituciones próximas a bloquearse), tabla filtrable/buscable.
  Login propio (usuario/contraseña) para acceder al dashboard — separado de las
  credenciales de BICSA (esas se guardan solo como secreto de entorno, nunca
  expuestas al frontend).
- **Todo orquestado con `docker-compose.yml`**: servicios separados para
  scraper/scheduler, base de datos, backend API, frontend.

### Modelo de datos (borrador)
- `instituciones` — catálogo (nombre, id interno propio).
- `snapshot_diario` — una fila por institución por día (foto de la corrida de las 07hs):
  estado, cant_max_busquedas, fecha_ultima_carga, calidad_datos, motivo_suspension,
  vencimiento_validacion, fecha_snapshot.
- `estado_actual` — última foto conocida por institución (se sobrescribe con cada
  corrida, incluida la de las 16hs).
- `historial_cambios` — log de eventos: institución, estado_anterior, estado_nuevo,
  fecha_deteccion, corrida_origen (07hs/16hs).

### Seguridad
- **Credenciales y Entorno:** Credenciales de BICSA y base de datos van en `.env`.
- **Firebase Auth:** El dashboard utiliza Firebase Authentication, y el backend valida rigurosamente cada Token JWT. Las credenciales de Admin SDK (`firebase-adminsdk.json`) nunca se suben al repositorio.
- **Rate Limiting:** El backend (FastAPI) utiliza `slowapi` limitando peticiones a `120 req/minuto` para evitar abusos o ataques DDoS.
- **CORS Estricto:** Los orígenes cruzados (CORS) están estrictamente limitados al dominio en producción (`DOMAIN`), bloqueando peticiones maliciosas de terceros.
- Confirmar con BICSA que este uso automatizado de mis propias credenciales es aceptable, para evitar bloqueo de cuenta.

## Qué necesito que Antigravity/Claude haga en esta primera etapa

1. Proponer y crear la **estructura de carpetas del proyecto** (monorepo con
   `scraper/`, `backend/`, `frontend/`, `db/`, `docker-compose.yml`, `.env.example`).
2. Armar el **Dockerfile del scraper** con Python + Playwright (Chromium),
   compatible multi-arquitectura (amd64/arm64).
3. Implementar el **script de login + scraping** contra
   `https://bicquerywebapp.azurewebsites.net/Instituciones_Estado.aspx`, extrayendo
   las 7 tablas descriptas arriba a estructuras de datos limpias (idealmente
   JSON/DataFrame).
4. Definir el **esquema de base de datos** (PostgreSQL) según el modelo de datos
   de arriba, con migraciones (ej. Alembic).
5. Implementar el **scheduler** (cron) para las corridas de 07:00 (completa) y
   16:00 (liviana), configurable por variables de entorno.
6. Implementar el **backend API** (FastAPI) con endpoints para: estado actual,
   histórico por institución, listado de cambios recientes, y export a Excel.
7. Implementar el **dashboard** (frontend) con: KPIs por estado, gráfico de
   evolución, tabla filtrable, alertas de instituciones próximas a las 72hs
   hábiles de bloqueo, botón de exportar Excel, login propio.
8. Documentar en un `README.md` cómo levantar todo en local (Docker Desktop en
   Windows) y cómo desplegarlo en la VM Oracle Cloud (build multi-arch + deploy
   por Git/SSH).

Empezar por el punto 1, 2 y 3 (estructura + scraper funcionando contra el portal
real), antes de avanzar con base de datos y dashboard, para validar cuanto antes
que el login/scraping funciona correctamente.

---

## Historial de Actualizaciones (Memoria)
- **Mejoras de Contactos y WhatsApp (Agosto 2026):**
  - **Estructura de Datos Híbrida:** Se almacena el número y nombre del contacto en la base de datos utilizando el mismo campo VARCHAR de la estructura original, concatenando los valores (`+595981234567|Juan Pérez`) para evitar migraciones en SQL.
  - **Envíos Individualizados:** El backend de notificaciones (`notificaciones.py`) ahora divide estos strings y ejecuta peticiones individuales a la API de WhatsApp por cada destinatario, permitiendo usar la variable `{nombre}` en los mensajes.
  - **Interfaz de Usuario (UX):** Se movió el selector de Tema al menú desplegable. Los botones de acción principal (Guardar) usan un estilo `.btn-blue` fijo. Se agregó una alerta `window.confirm` para prevenir el borrado accidental de teléfonos. El menú de instituciones pendientes fue renombrado a "Cargar Contacto" y admite cargar múltiples teléfonos simultáneamente.
  - **Túnel SSH SOCKS5 Seguro:** Debido a que el firewall de la oficina (FortiGate) bloquea APIs necesarias (como Firebase Auth), se estableció un proceso documentado (`GUIA_TUNEL_PRIVADO_SSH.md`) para conectarse por SSH al servidor de Oracle en el puerto 9090 (Proxy SOCKS5 local) con KeepAlive para usar el sistema a través de Firefox libremente sin ser interceptado.
