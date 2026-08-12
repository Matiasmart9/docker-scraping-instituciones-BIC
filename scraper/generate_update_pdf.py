import asyncio
import os
import logging
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdf_generator")

OUTPUT_PDF_PATH = "GUIA_ACTUALIZACION_PRODUCCION.pdf"

HTML_DOCUMENT = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Guía de Actualización - Oracle Cloud</title>
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

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; color: #1E293B; line-height: 1.6; font-size: 10pt; background-color: #FFFFFF; }
    
    /* Cover Page */
    .cover-page {
      height: 90vh; display: flex; flex-direction: column; justify-content: space-between;
      padding: 40px 20px; border-left: 6px solid #10B981;
    }
    .badge-tag {
      display: inline-block; padding: 6px 14px; background: #ECFDF5; color: #059669;
      font-weight: 700; font-size: 9pt; border-radius: 20px; text-transform: uppercase;
      letter-spacing: 1px; margin-bottom: 20px;
    }
    .cover-title {
      font-family: 'Outfit', sans-serif; font-size: 28pt; font-weight: 800;
      color: #0F172A; line-height: 1.2; margin-bottom: 15px;
    }
    .cover-subtitle { font-size: 14pt; color: #475569; font-weight: 400; margin-bottom: 30px; }
    .cover-meta {
      background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-top: 40px;
    }
    .meta-item { margin-bottom: 8px; font-size: 9.5pt; }
    .meta-item strong { color: #0F172A; width: 160px; display: inline-block; }

    /* Content Typography */
    h1 {
      font-family: 'Outfit', sans-serif; font-size: 18pt; font-weight: 700; color: #0F172A;
      margin-top: 25px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0;
    }
    h2 { font-family: 'Outfit', sans-serif; font-size: 14pt; font-weight: 600; color: #1E293B; margin-top: 20px; margin-bottom: 10px; }
    p { margin-bottom: 12px; text-align: justify; }
    ul, ol { margin-left: 20px; margin-bottom: 14px; }
    li { margin-bottom: 6px; }

    /* Callouts & Code */
    .info-box { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 14px 18px; border-radius: 6px; margin: 15px 0; font-size: 9.5pt; }
    .warning-box { background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 14px 18px; border-radius: 6px; margin: 15px 0; font-size: 9.5pt; }
    code { font-family: 'Courier New', Courier, monospace; background: #F1F5F9; color: #0F172A; padding: 2px 6px; border-radius: 4px; font-size: 8.5pt; }
    pre {
      background: #0F172A; color: #F8FAFC; padding: 14px; border-radius: 8px; overflow-x: auto;
      font-family: 'Courier New', Courier, monospace; font-size: 8.5pt; margin: 15px 0; line-height: 1.4;
    }
  </style>
</head>
<body>

  <!-- PORTADA -->
  <div class="cover-page">
    <div>
      <span class="badge-tag">Mantenimiento y Operaciones (DevOps)</span>
      <h1 class="cover-title">GUÍA DE ACTUALIZACIÓN EN PRODUCCIÓN (CI/CD MANUAL)</h1>
      <div class="cover-subtitle">Proceso estandarizado para sincronizar cambios desde GitHub hacia Oracle Cloud</div>
    </div>

    <div class="cover-meta">
      <div class="meta-item"><strong>Entorno:</strong> Producción (Oracle Cloud Ubuntu ARM64)</div>
      <div class="meta-item"><strong>Control de Versiones:</strong> GitHub (Rama main)</div>
      <div class="meta-item"><strong>Tecnologías Core:</strong> Docker Compose, Git, SSH</div>
      <div class="meta-item"><strong>Generación de Guía:</strong> Agosto 2026</div>
    </div>
  </div>

  <div style="page-break-before: always;"></div>

  <h1>Procedimiento de Actualización</h1>
  <p>
    Esta guía documenta los tres simples pasos que deben ejecutarse en el servidor de producción (Oracle Cloud) cada vez que se realicen mejoras, correcciones o actualizaciones en el código fuente alojado en el repositorio de GitHub. 
  </p>
  
  <p>
    Al utilizar una arquitectura basada en contenedores (Docker), las actualizaciones se realizan de forma limpia, nativa (ARM64) y sin tiempo prolongado de inactividad (Downtime).
  </p>

  <h2>Paso 1: Ingresar al servidor por SSH</h2>
  <p>Desde cualquier consola (PowerShell en Windows), conéctese utilizando la llave privada de seguridad y el usuario ubuntu:</p>
  <pre>
ssh -i "ssh-key-2026-08-04.key" ubuntu@141.148.159.57
  </pre>

  <h2>Paso 2: Descargar los últimos cambios (Git Pull)</h2>
  <p>Una vez dentro de la máquina virtual, debe navegar hacia la carpeta donde reside el proyecto y solicitar a GitHub que descargue las últimas versiones de los archivos.</p>
  <pre>
# Ingresar a la carpeta del proyecto
cd docker-scraping-instituciones-BIC

# Sincronizar y descargar los cambios de la rama principal (main)
git pull origin main
  </pre>
  
  <div class="info-box">
    <strong>Nota:</strong> Si el comando <code>git pull</code> responde con <em>"Already up to date."</em>, significa que el servidor ya tiene la versión más reciente y no hay cambios nuevos para aplicar.
  </div>

  <h2>Paso 3: Reconstruir y reiniciar los contenedores</h2>
  <p>Finalmente, debe indicarle a Docker que vuelva a compilar el código fuente y aplique los cambios. Puede decidir reconstruir todo el ecosistema o solo componentes específicos.</p>
  
  <p><strong>Opción A - Actualización Total (Recomendada):</strong></p>
  <p>Reconstruye tanto el Frontend (página web), Backend (API y base de datos) como el Scraper.</p>
  <pre>
sudo docker compose up -d --build
  </pre>

  <p><strong>Opción B - Actualización Parcial (Solo Frontend):</strong></p>
  <p>Si los cambios fueron únicamente visuales o de interfaz (ej. cambiar un logo, colores, botones), puede compilar solo el frontend para hacerlo más rápido y no afectar el scraper en segundo plano:</p>
  <pre>
sudo docker compose up -d --build frontend
  </pre>

  <div class="warning-box">
    <strong>¿Qué significa el flag <code>-d</code>?</strong><br>
    La letra "d" significa <em>detached</em> (en segundo plano). Esto permite que, una vez que Docker termine de levantar el sistema, usted pueda cerrar la ventana negra (escribiendo <code>exit</code>) y su servidor seguirá corriendo 24/7 sin interrumpirse.
  </div>

</body>
</html>
"""

async def generate_pdf():
    logger.info("Generando Documento de Guía de Actualización...")
    
    html_path = "guia_actualizacion_temp.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(HTML_DOCUMENT)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        page = await browser.new_page()
        
        abs_path = f"file://{os.path.abspath(html_path)}"
        await page.goto(abs_path, wait_until="networkidle")

        await page.pdf(
            path=OUTPUT_PDF_PATH,
            format="A4",
            print_background=True,
            margin={"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"}
        )
        await browser.close()

    logger.info(f"¡PDF generado con éxito en {OUTPUT_PDF_PATH}!")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
