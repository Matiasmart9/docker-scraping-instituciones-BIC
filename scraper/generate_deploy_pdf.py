import asyncio
import os
import logging
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pdf_generator")

OUTPUT_PDF_PATH = "GUIA_DESPLIEGUE_ORACLE_CLOUD.pdf"

HTML_DOCUMENT = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Guía Oficial de Despliegue - Oracle Cloud</title>
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
    .page-break { page-break-before: always; }
    
    /* Cover Page */
    .cover-page {
      height: 90vh; display: flex; flex-direction: column; justify-content: space-between;
      padding: 40px 20px; border-left: 6px solid #F97316;
    }
    .badge-tag {
      display: inline-block; padding: 6px 14px; background: #FFF7ED; color: #EA580C;
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
      <span class="badge-tag">Guía de Infraestructura y Despliegue</span>
      <h1 class="cover-title">PASO A PASO: DESPLIEGUE EN ORACLE CLOUD (ARM64)</h1>
      <div class="cover-subtitle">Portal Satélite de Monitoreo de Estado de Instituciones BICSA</div>
    </div>

    <div class="cover-meta">
      <div class="meta-item"><strong>Plataforma Destino:</strong> Oracle Cloud Infrastructure (OCI)</div>
      <div class="meta-item"><strong>Sistema Operativo:</strong> Ubuntu Linux 22.04 LTS (Arquitectura ARM64 aarch64)</div>
      <div class="meta-item"><strong>Tecnologías Core:</strong> Docker Compose, Git, SSH, iptables</div>
      <div class="meta-item"><strong>Generación de Guía:</strong> Agosto 2026</div>
    </div>
  </div>

  <div class="page-break"></div>

  <h1>Resumen del Despliegue</h1>
  <p>
    Esta guía documenta el procedimiento exacto realizado para poner en producción el <strong>Portal Satélite de BICSA</strong> en una máquina virtual de Oracle Cloud. Dado que el servidor utiliza procesadores de arquitectura ARM (aarch64), el despliegue requiere descargar el código fuente y construir las imágenes de Docker de manera nativa dentro del propio servidor.
  </p>

  <h2>Paso 1: Preparación Local y Conexión SSH</h2>
  <p>Para acceder al servidor desde una terminal de Windows (PowerShell), es imperativo que los permisos de la llave de seguridad `.key` sean privados, de lo contrario, Windows OpenSSH rechazará la conexión por seguridad ("Bad permissions").</p>
  
  <p><strong>1.1 Arreglar Permisos de la Llave en Windows:</strong></p>
  <pre>
# Remover herencia compartida
icacls "ssh-key-2026-08-04.key" /inheritance:r

# Dar permiso de lectura exclusiva al usuario actual
icacls "ssh-key-2026-08-04.key" /grant:r "$($env:USERNAME):(R)"
  </pre>

  <p><strong>1.2 Conexión al Servidor Ubuntu:</strong></p>
  <pre>
ssh -i "ssh-key-2026-08-04.key" ubuntu@141.148.159.57
  </pre>

  <h2>Paso 2: Instalación Limpia de Docker en Ubuntu</h2>
  <p>Para evitar conflictos entre el paquete <code>containerd</code> nativo de Ubuntu y el motor de Docker, se recomienda desinstalar cualquier versión previa y utilizar el script oficial de instalación.</p>
  <pre>
# Eliminar posibles paquetes conflictivos o antiguos
sudo apt-get remove -y docker docker-engine docker.io containerd runc

# Descargar e instalar Docker CE Oficial
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Otorgar permisos al usuario ubuntu para ejecutar docker sin sudo
sudo usermod -aG docker $USER
  </pre>
  <div class="warning-box">
    <strong>Importante:</strong> Tras ejecutar `usermod`, se debe cerrar la sesión (escribiendo <code>exit</code>) y volver a conectar por SSH, o en su defecto ejecutar <code>newgrp docker</code>, para que los grupos se actualicen y se evite el error <em>permission denied at docker.sock</em>.
  </div>

  <h2>Paso 3: Descarga y Configuración del Proyecto</h2>
  <p>El código fuente y los archivos <code>Dockerfile</code> están alojados en un repositorio de GitHub, listos para ser compilados en cualquier arquitectura.</p>
  <pre>
# Clonar repositorio
git clone https://github.com/Matiasmart9/docker-scraping-instituciones-BIC.git
cd docker-scraping-instituciones-BIC

# Crear y editar variables de entorno seguras
cp .env.example .env
nano .env
  </pre>
  <p>Dentro del editor `nano`, se ingresan las credenciales críticas como `BICSA_USER`, `BICSA_PASSWORD`, y `POSTGRES_PASSWORD`.</p>

  <div class="page-break"></div>

  <h2>Paso 4: Verificación del docker-compose.yml</h2>
  <p>El sistema se apoya en 4 contenedores conectados a través de una red interna de Docker. Es crucial que los mapeos de puertos (`ports`) se realicen correctamente para evitar conflictos (ej. Error: <em>Bind for 0.0.0.0:8000 failed: port is already allocated</em>).</p>
  
  <p>Asegúrese de que el archivo <code>docker-compose.yml</code> tenga la configuración correcta de puertos para que no colisione con servicios existentes en Oracle Cloud (como Webmin):</p>
  
  <pre>
  backend:
    ...
    ports:
      - "8002:8000"  # Expone el API Backend al puerto externo 8002 (interno 8000)

  scraper:
    ...
    environment:
      - BACKEND_URL=http://backend:8000  # Siempre usa puerto interno 8000

  frontend:
    ...
    ports:
      - "3000:80"    # Expone la página web al puerto 3000 (interno 80 de Nginx)
  </pre>

  <h2>Paso 5: Construcción de Imágenes Nativas y Despliegue</h2>
  <p>Ejecute el orquestador de Docker para descargar Alpine Linux, Python y Node, compilando el código directamente para la CPU ARM64.</p>
  <pre>
sudo docker compose up -d --build
  </pre>
  <p>Al finalizar, todos los contenedores deben aparecer con estado <em>Started</em> o <em>Healthy</em> (para la Base de Datos).</p>

  <h2>Paso 6: Configuración de Firewall (Reglas Ingress)</h2>
  <p>Para permitir el acceso público a la plataforma, se debe autorizar el puerto 3000 en las dos capas de seguridad presentes en la nube:</p>

  <p><strong>6.1 Iptables de Ubuntu (Firewall Interno):</strong></p>
  <pre>
# Permitir tráfico TCP entrante en el puerto 3000
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
  </pre>

  <p><strong>6.2 Consola Oracle Cloud (VCN Ingress):</strong></p>
  <ul>
    <li>Ir a <em>Virtual Cloud Networks</em> > Seleccionar Subnet > <em>Security Lists</em>.</li>
    <li>Agregar <em>Ingress Rule</em>: Source <code>0.0.0.0/0</code>, Protocolo <code>TCP</code>, Destination Port <code>3000</code>.</li>
  </ul>

  <div class="info-box">
    <strong>Verificación Final:</strong> Al completar todos estos pasos, el sistema quedará expuesto y funcional accediendo desde el navegador a la dirección pública <code>http://141.148.159.57:3000</code>. Al ser el primer despliegue, el dashboard se mostrará en cero hasta hacer clic en <strong>Ejecutar Scraping</strong> para popular la base de datos inicial.
  </div>

</body>
</html>
"""

async def generate_pdf():
    logger.info("Generando Documento de Guía de Despliegue...")
    
    html_path = "guia_despliegue_temp.html"
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
