import asyncio
import os
import logging
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdf_generator")

OUTPUT_PDF_PATH = "DOCUMENTACION_COMPLETA_BICSA_SATELITE.pdf"

HTML_DOCUMENT = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Documentación Oficial - Portal Satélite BICSA</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Inter', sans-serif;
        font-size: 9pt;
        color: #64748B;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', sans-serif;
      color: #1E293B;
      line-height: 1.6;
      font-size: 10pt;
      background-color: #FFFFFF;
    }

    .page-break {
      page-break-before: always;
    }

    /* Cover Page */
    .cover-page {
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 20px;
      border-left: 6px solid #6366F1;
    }

    .cover-header {
      margin-top: 40px;
    }

    .badge-tag {
      display: inline-block;
      padding: 6px 14px;
      background: #EEF2FF;
      color: #4F46E5;
      font-weight: 700;
      font-size: 9pt;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 20px;
    }

    .cover-title {
      font-family: 'Outfit', sans-serif;
      font-size: 28pt;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.2;
      margin-bottom: 15px;
    }

    .cover-subtitle {
      font-size: 14pt;
      color: #475569;
      font-weight: 400;
      margin-bottom: 30px;
    }

    .cover-meta {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 20px;
      margin-top: 40px;
    }

    .meta-item {
      margin-bottom: 8px;
      font-size: 9.5pt;
    }

    .meta-item strong {
      color: #0F172A;
      width: 140px;
      display: inline-block;
    }

    /* Headings */
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 18pt;
      font-weight: 700;
      color: #0F172A;
      margin-top: 25px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #E2E8F0;
    }

    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 14pt;
      font-weight: 600;
      color: #1E293B;
      margin-top: 20px;
      margin-bottom: 10px;
    }

    h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
    }

    p {
      margin-bottom: 12px;
      text-align: justify;
    }

    ul, ol {
      margin-left: 20px;
      margin-bottom: 14px;
    }

    li {
      margin-bottom: 6px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 9pt;
    }

    th {
      background: #1E293B;
      color: #FFFFFF;
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
    }

    td {
      padding: 9px 12px;
      border-bottom: 1px solid #E2E8F0;
    }

    tr:nth-child(even) td {
      background: #F8FAFC;
    }

    /* Callout Boxes */
    .info-box {
      background: #EFF6FF;
      border-left: 4px solid #3B82F6;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 15px 0;
      font-size: 9.5pt;
    }

    .warning-box {
      background: #FFFBEB;
      border-left: 4px solid #F59E0B;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 15px 0;
      font-size: 9.5pt;
    }

    .critical-box {
      background: #FEF2F2;
      border-left: 4px solid #EF4444;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 15px 0;
      font-size: 9.5pt;
    }

    code {
      font-family: 'Courier New', Courier, monospace;
      background: #F1F5F9;
      color: #0F172A;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5pt;
    }

    pre {
      background: #0F172A;
      color: #F8FAFC;
      padding: 14px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Courier New', Courier, monospace;
      font-size: 8.5pt;
      margin: 15px 0;
      line-height: 1.4;
    }
  </style>
</head>
<body>

  <!-- PORTADA -->
  <div class="cover-page">
    <div class="cover-header">
      <span class="badge-tag">Documentación Oficial Completa</span>
      <h1 class="cover-title">PORTAL SATÉLITE DE MONITOREO DE ESTADO DE INSTITUCIONES</h1>
      <div class="cover-subtitle">Manual del Usuario Final y Especificación Técnica de Arquitectura</div>
    </div>

    <div class="cover-meta">
      <div class="meta-item"><strong>Sistema Fuente:</strong> Portal Web BICSA (ASP.NET WebForms / Azure AD SSO)</div>
      <div class="meta-item"><strong>Solución Desarrollada:</strong> Espejo Satélite de Solo Lectura & Auditoría 24/7</div>
      <div class="meta-item"><strong>Versión:</strong> 1.0.0 Producción</div>
      <div class="meta-item"><strong>Fecha de Emisión:</strong> Agosto 2026</div>
      <div class="meta-item"><strong>Tecnologías:</strong> Playwright, Python FastAPI, PostgreSQL, React, Nginx, Docker</div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ÍNDICE DE CONTENIDOS -->
  <h1>Tabla de Contenidos</h1>
  <ol>
    <li><strong>SECCIÓN I: MANUAL DEL USUARIO</strong>
      <ol type="a">
        <li>Propósito y Alcance de la Solución Satélite</li>
        <li>Acceso al Dashboard y Autenticación</li>
        <li>Comprensión de Tarjetas KPI y Estados de Instituciones</li>
        <li>Motor de Alertas por Horas Hábiles (Límite 72h XML)</li>
        <li>Uso de Filtros por Categoría y Buscador en Tiempo Real</li>
        <li>Exportación de Reportes a Excel (.xlsx)</li>
        <li>Ejecución de Scraping Manual y Consulta de Historial Auditable</li>
      </ol>
    </li>
    <li><strong>SECCIÓN II: MANUAL TÉCNICO Y ARQUITECTURA</strong>
      <ol type="a">
        <li>Arquitectura General Monorepo en Docker</li>
        <li>Módulo Scraper con Autenticación Azure AD / Microsoft SSO</li>
        <li>Diseño de Base de Datos PostgreSQL (Modelos SQLAlchemy)</li>
        <li>Lógica de Negocio de Horas Hábiles y Niveles de Alerta</li>
        <li>Backend RESTful API (FastAPI) y Generador de Excel</li>
        <li>Servicio Frontend SPA (React + Nginx Glassmorphic UI)</li>
        <li>Planificación de Corridas Cron (07:00 hs y 16:00 hs)</li>
        <li>Guía de Despliegue Local (Windows 11 + Docker Desktop)</li>
        <li>Guía de Despliegue en Producción (Oracle Cloud VM ARM64)</li>
      </ol>
    </li>
  </ol>

  <div class="page-break"></div>

  <!-- PARTE I: MANUAL DEL USUARIO -->
  <h1>SECCIÓN I: MANUAL DEL USUARIO</h1>

  <h2>1.1 Propósito y Alcance de la Solución Satélite</h2>
  <p>
    El <strong>Portal Satélite de Monitoreo BICSA</strong> es una plataforma web independiente desarrollada exclusivamente para el **seguimiento, auditoría y alerta temprana** sobre el estado operacional de las instituciones financieras registradas en el portal BICSA.
  </p>
  <div class="info-box">
    <strong>⚠️ Principio de Solo Lectura:</strong> Este sistema satélite actúa como un espejo/monitor externo de consulta. **NO modifica** ni altera los datos o estados reales dentro del portal original de BICSA, ya que BICSA administra sus transiciones con su propio proceso nocturno (24/7 a las 00:00 hs).
  </div>

  <h2>1.2 Acceso al Dashboard y Autenticación</h2>
  <p>Para ingresar al Dashboard Satélite:</p>
  <ul>
    <li>Abrir el navegador web e ingresar la dirección URL: <code>http://localhost:3000</code> (o la dirección IP del servidor en nube).</li>
    <li>Ingresar con las credenciales asignadas para el Dashboard Satélite:
      <ul>
        <li><strong>Usuario:</strong> <code>admin@bicsasatelite.com</code></li>
        <li><strong>Contraseña:</strong> <code>AdminPassword2026!</code></li>
      </ul>
    </li>
  </ul>

  <h2>1.3 Tarjetas KPI y Estados de Instituciones</h2>
  <p>En la parte superior del Dashboard se presentan tarjetas de resumen con los indicadores principales:</p>
  <table>
    <thead>
      <tr>
        <th>Indicador KPI</th>
        <th>Descripción</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Total Registradas</strong></td>
        <td>Total de instituciones financieras vigentes obtenidas de la última sincronización.</td>
      </tr>
      <tr>
        <td><strong>Activas</strong></td>
        <td>Instituciones operativas que cuentan con carga de XML al día y consultas permitidas.</td>
      </tr>
      <tr>
        <td><strong>Activa (límite de consultas)</strong></td>
        <td>Instituciones activas que han excedido o están cerca del límite de volumen de consultas permitido por BICSA.</td>
      </tr>
      <tr>
        <td><strong>Bloqueadas</strong></td>
        <td>Instituciones bloqueadas por BICSA por haber superado las 72 horas hábiles sin carga.</td>
      </tr>
      <tr>
        <td><strong>Suspendidas</strong></td>
        <td>Instituciones suspendidas por inconsistencias administrativas o de formato XML.</td>
      </tr>
      <tr>
        <td><strong>Validación XML</strong></td>
        <td>Instituciones en etapa previa/paralela de validación de archivos XML.</td>
      </tr>
    </tbody>
  </table>

  <h2>1.4 Motor de Alertas por Horas Hábiles (Límite 72h)</h2>
  <p>
    BICSA exige que cada institución activa realice la carga de su archivo XML dentro de un plazo máximo de **72 horas hábiles** (lunes a viernes). Si transcurre dicho plazo sin carga, BICSA cambia el estado a **Bloqueada**.
  </p>
  <p>El Portal Satélite evalúa en tiempo real el tiempo hábil transcurrido y clasifica la alerta en 3 niveles de color:</p>

  <div class="info-box">
    🟢 <strong>NORMAL (Verde):</strong> Transcurrieron menos de 48 horas hábiles desde la última carga. La institución se encuentra al día.
  </div>
  <div class="warning-box">
    🟡 <strong>Advertencia ( 48h-72h sin carga):</strong> Transcurrieron entre 48 y 72 horas hábiles sin carga. La institución dispone de menos de 24 horas hábiles antes de ser bloqueada.
  </div>
  <div class="critical-box">
    🔴 <strong>Estado Crítico ( &gt;72h sin carga):</strong> Transcurrieron más de 72 horas hábiles sin carga XML. Riesgo inminente de bloqueo por el proceso nocturno de BICSA.
  </div>

  <div class="info-box">
    <strong>Exclusión de Instituciones Desvinculadas, Bloqueadas y Suspendidas:</strong> Las instituciones que ya se encuentran en estado <em>Desvinculada</em> (contrato cesado), <em>Bloqueada</em> o <em>Suspendida</em> son excluidas de las alertas de carga preventiva, mostrando badge neutro o su estado correspondiente.
  </div>

  <h2>1.5 Filtros y Buscador en Tiempo Real</h2>
  <ul>
    <li><strong>Pestañas de Categorías:</strong> Permiten filtrar la tabla por las 7 categorías oficiales: <em>Todas, Activa, Suspendida, Bloqueada, Con excepción de carga, Desvinculada, Validación de XML, Activa (límite de consultas)</em>.</li>
    <li><strong>Barra de Búsqueda:</strong> Filtra instantáneamente por el nombre de la institución o por el motivo de suspensión.</li>
  </ul>

  <h2>1.6 Exportación de Reportes a Excel (.xlsx) y Backup Diario</h2>
  <p>
    El sistema genera de forma automatizada un único archivo de backup diario consolidado en la carpeta <code>Backup_Scraping</code>, nombrado bajo el estándar <code>BICSA_Reporte_YYYY_MM_DD.xlsx</code>. Esto previene la duplicación de archivos si ocurren múltiples extracciones en la misma fecha.
  </p>
  <p>
    Al hacer clic en el botón <strong>"Exportar Excel"</strong>, los usuarios pueden descargar instantáneamente un reporte estilizado profesionalmente con la vista actual de los datos.
  </p>

  <h2>1.7 Scraping Manual, Historial Auditable y Ajustes de Zona Horaria</h2>
  <ul>
    <li><strong>Ejecutar Scraping:</strong> Dispara de inmediato la extracción en vivo desde BICSA sin esperar al cron automático.</li>
    <li><strong>Gestor de Historial:</strong> Abre una ventana modal avanzada que muestra el historial de reportes Excel diarios generados. Incluye filtros por año y mes, botones para descargar o eliminar archivos, y <strong>paginación de 31 filas (máximo un mes) por página con scroll integrado</strong>.</li>
    <li><strong>Hora Local (Asunción, UTC-3):</strong> Tanto los KPIs del dashboard como los archivos exportados están ajustados estrictamente a la hora local oficial de Asunción, garantizando exactitud cronológica sin los desfases nativos de la nube.</li>
  </ul>

  <div class="page-break"></div>

  <!-- PARTE II: MANUAL TÉCNICO -->
  <h1>SECCIÓN II: MANUAL TÉCNICO Y ARQUITECTURA</h1>

  <h2>2.1 Arquitectura General Monorepo en Docker</h2>
  <p>
    El sistema está diseñado como un monorepo compuesto por 4 microservicios desacoplados y orquestados mediante <code>docker-compose.yml</code>:
  </p>
  <pre>
┌────────────────────────────────────────────────────────────────────────┐
│                        Nginx Frontend (Port 3000)                      │
│                  Single Page Application (React + CSS)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST API
┌───────────────────────────────────▼────────────────────────────────────┐
│                        FastAPI Backend (Port 8000)                     │
│               SQLAlchemy ORM + Generador Excel openpyxl                │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ SQL                             │ Internal Sync API
┌──────────────────▼──────────────────┐   ┌──────────▼───────────────────┐
│     PostgreSQL 16 (Port 5432)       │   │    Playwright Scraper /      │
│   Volume persistente postgres_data  │   │   APScheduler (Port 8001)    │
└─────────────────────────────────────┘   └──────────────────────────────┘
  </pre>

  <h2>2.2 Módulo Scraper con Autenticación Azure AD SSO</h2>
  <p>
    El microservicio <code>scraper</code> utiliza **Python + Playwright (Headless Chromium)** debido a que la aplicación fuente de BICSA se encuentra protegida por **Microsoft Azure Active Directory (Azure AD / Entra ID SSO)**.
  </p>
  <h3>Flujo de Autenticación Playwright:</h3>
  <ol>
    <li>Navega a <code>https://bicquerywebapp.azurewebsites.net</code> y detecta la redirección hacia <code>login.microsoftonline.com</code>.</li>
    <li>Completa el campo de correo <code>input[name='loginfmt']</code> con <code>BICSA_USER</code> y presiona el botón Siguiente.</li>
    <li>Completa el campo de contraseña <code>input[name='passwd']</code> con <code>BICSA_PASSWORD</code> y presiona Iniciar sesión.</li>
    <li>Resuelve o salta el diálogo de permanencia de sesión (<code>idSIButton9</code>).</li>
    <li>Navega a la pantalla <code>Instituciones_Estado.aspx</code> y extrae el HTML completo.</li>
    <li>Parse el HTML usando <strong>BeautifulSoup</strong>, limpiando las filas y mapeando dinámicamente las 10 tablas HTML.</li>
    <li>Envia los datos mediante un <code>POST</code> interno al backend a <code>/api/v1/internal/sync-scrape</code>.</li>
  </ol>

  <h2>2.3 Modelo de Base de Datos PostgreSQL</h2>
  <p>Modelos relacionales principales definidos en SQLAlchemy:</p>
  <ul>
    <li><code>instituciones</code>: Catálogo maestro (id, nombre, codigo_bicsa, creado_el).</li>
    <li><code>estado_actual</code>: Foto más reciente por institución (con restricción <em>UNIQUE(institucion_id)</em>, horas hábiles transcurridas, horas restantes y nivel_alerta).</li>
    <li><code>snapshot_diario</code>: Registro histórico capturado durante la corrida de las 07:00 hs.</li>
    <li><code>historial_cambios</code>: Eventos auditables de transición de estado (estado_anterior, estado_nuevo, fecha_deteccion, corrida_origen).</li>
    <li><code>usuarios</code>: Cuentas de acceso local al Dashboard (email, hashed_password con bcrypt).</li>
  </ul>

  <h2>2.4 Lógica de Negocio de Horas Hábiles</h2>
  <p>
    La función <code>calcular_horas_habiles(fecha_inicio, fecha_fin)</code> itera día por día evaluando <code>weekday() < 5</code> (lunes=0 a viernes=4), descartando sábados y domingos.
  </p>
  <pre>
horas_transcurridas = calcular_horas_habiles(fecha_carga, ahora)
horas_restantes = max(0.0, round(72.0 - horas_transcurridas, 2))

if horas_transcurridas > 72.0:
    nivel_alerta = "CRITICO"
elif horas_transcurridas >= 48.0:
    nivel_alerta = "ADVERTENCIA"
else:
    nivel_alerta = "NORMAL"
  </pre>

  <h2>2.5 Programación Cron de Scrapes</h2>
  <ul>
    <li><strong>07:00 hs (Diario)</strong>: Corrida <code>FULL</code>. Genera el <code>SnapshotDiario</code> y registra variaciones en <code>HistorialCambios</code>.</li>
    <li><strong>16:00 hs (Lunes a Viernes)</strong>: Corrida <code>LIGHT</code>. Refresca únicamente la vista de <code>EstadoActual</code> en vivo.</li>
  </ul>

  <h2>2.6 Guía de Despliegue en Producción (Oracle Cloud VM ARM64)</h2>
  <p>
    Para compilar las imágenes en arquitectura multi-plataforma (amd64 para Windows y arm64 para Oracle Cloud Ubuntu 22.04):
  </p>
  <pre>
# Crear builder multi-arquitectura
docker buildx create --name multiarch-builder --use
docker buildx inspect --bootstrap

# Compilar e impulsar imágenes
docker buildx build --platform linux/amd64,linux/arm64 -t usuario/bicsa-scraper:latest ./scraper --push
docker buildx build --platform linux/amd64,linux/arm64 -t usuario/bicsa-backend:latest ./backend --push
docker buildx build --platform linux/amd64,linux/arm64 -t usuario/bicsa-frontend:latest ./frontend --push
  </pre>
  <p>En la máquina virtual Oracle Cloud ARM64:</p>
  <pre>
git clone https://github.com/tu-repo/docker-portal-estado-institucionesBIC.git
cd docker-portal-estado-institucionesBIC
cp .env.example .env
nano .env  # Configurar credenciales reales de BICSA
docker compose up -d
  </pre>

  <h2>2.7 Monitoreo y Diagnóstico de Logs</h2>
  <pre>
# Ver logs del backend
docker logs -f bicsa_backend

# Ver logs del scraper y Playwright
docker logs -f bicsa_scraper

# Ver estado de los contenedores
docker compose ps
  </pre>

</body>
</html>
"""

async def generate_pdf():
    logger.info("Iniciando generación de la Documentación Completa en PDF con Playwright...")
    
    # Escribir HTML temporal
    html_path = "documentacion_temp.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(HTML_DOCUMENT)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        page = await browser.new_page()
        
        abs_path = f"file://{os.path.abspath(html_path)}"
        logger.info(f"Cargando HTML en navegador Playwright: {abs_path}")
        await page.goto(abs_path, wait_until="networkidle")

        logger.info(f"Exportando PDF hacia {OUTPUT_PDF_PATH}...")
        await page.pdf(
            path=OUTPUT_PDF_PATH,
            format="A4",
            print_background=True,
            margin={
                "top": "20mm",
                "bottom": "20mm",
                "left": "15mm",
                "right": "15mm"
            }
        )
        await browser.close()

    logger.info(f"¡PDF generado con éxito en {OUTPUT_PDF_PATH}!")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
