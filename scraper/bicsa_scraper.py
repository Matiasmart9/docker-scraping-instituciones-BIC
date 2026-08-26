import os
import sys
import re
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("bicsa_scraper")

BICSA_BASE_URL = os.getenv("BICSA_BASE_URL", "https://bicquerywebapp.azurewebsites.net")
BICSA_USER = os.getenv("BICSA_USER", "")
BICSA_PASSWORD = os.getenv("BICSA_PASSWORD", "")
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"

TARGET_PATH = "/Instituciones_Estado.aspx"

TABLA_ESTADOS = [
    "Activa (límite de consultas)",
    "Con excepción de carga",
    "Validación de XML",
    "Desvinculada",
    "Suspendida",
    "Bloqueada",
    "Activa"
]

class BicsaScraper:
    def __init__(self, base_url: str = BICSA_BASE_URL, username: str = BICSA_USER, password: str = BICSA_PASSWORD):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password

    async def login_and_scrape(self) -> Dict[str, Any]:
        """
        Realiza la autenticación en BICSA (vía Azure AD / Microsoft SSO o login directo) 
        y extrae el estado de todas las instituciones financieras desde Instituciones_Estado.aspx.
        """
        start_time = datetime.now()
        logger.info(f"Iniciando proceso de scraping hacia {self.base_url} para el usuario '{self.username}'...")

        if not self.username or not self.password or self.username == "usuario_demo":
            logger.warning("Credenciales de BICSA en modo DEMO. Retornando datos de prueba.")
            return self._generate_mock_data(start_time)

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=HEADLESS,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ]
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 960},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            try:
                # 1. Navegar a la página principal de BICSA
                logger.info(f"Navegando a página inicial: {self.base_url}")
                await page.goto(self.base_url, wait_until="networkidle", timeout=30000)
                logger.info(f"URL actual: {page.url}")

                # 2. Manejo de Autenticación (Azure AD Microsoft SSO o Login Form)
                if "login.microsoftonline.com" in page.url or "login.live.com" in page.url:
                    logger.info("Detectado portal de autenticación Azure AD / Microsoft SSO.")
                    
                    # 2a. Ingresar Correo Electrónico
                    logger.info("Esperando campo de usuario (loginfmt)...")
                    await page.wait_for_selector("input[name='loginfmt']", timeout=20000)
                    await page.fill("input[name='loginfmt']", self.username)
                    logger.info("Correo ingresado. Clic en Siguiente...")
                    await page.click("input[id='idSIButton9']")

                    # 2b. Ingresar Contraseña
                    logger.info("Esperando campo de contraseña (passwd)...")
                    await page.wait_for_selector("input[name='passwd']", timeout=20000)
                    await page.fill("input[name='passwd']", self.password)
                    logger.info("Contraseña ingresada. Clic en Iniciar sesión...")
                    await page.click("input[id='idSIButton9']")

                    # 2c. Manejar diálogo '¿Desea mantener la sesión iniciada?'
                    try:
                        logger.info("Verificando diálogo 'Mantener sesión iniciada'...")
                        await page.wait_for_selector("input[id='idSIButton9']", timeout=8000)
                        await page.click("input[id='idSIButton9']")
                    except Exception:
                        logger.info("Diálogo de permanencia de sesión no presentado.")

                    await page.wait_for_load_state("networkidle", timeout=30000)
                    logger.info(f"Autenticación Azure AD completada. URL: {page.url}")
                else:
                    # Intento de login ASP.NET WebForms Estándar
                    logger.info("Intentando formulario estándar de login WebForms...")
                    user_input = await page.query_selector("input[name*='User'], input[name*='txtUsuario'], #txtUsuario")
                    if user_input:
                        await user_input.fill(self.username)
                        pass_input = await page.query_selector("input[type='password']")
                        if pass_input:
                            await pass_input.fill(self.password)
                        btn = await page.query_selector("input[type='submit'], #btnLogin")
                        if btn:
                            await btn.click()
                        await page.wait_for_load_state("networkidle", timeout=30000)

                # 3. Navegar a la pantalla objetivo de Estado de Instituciones
                target_url = f"{self.base_url}{TARGET_PATH}"
                logger.info(f"Navegando a la pantalla de Estado de Instituciones: {target_url}")
                await page.goto(target_url, wait_until="networkidle", timeout=30000)

                html_content = await page.content()
                logger.info("HTML obtenido exitosamente de Instituciones_Estado.aspx")

                # 4. Parsear HTML con BeautifulSoup
                instituciones = self._parse_html(html_content)

                execution_time = (datetime.now() - start_time).total_seconds()
                logger.info(f"Scraping completado exitosamente. Total instituciones extraídas: {len(instituciones)} en {execution_time:.2f}s")

                return {
                    "timestamp": datetime.now().isoformat(),
                    "total_instituciones": len(instituciones),
                    "execution_seconds": execution_time,
                    "status": "SUCCESS",
                    "data": instituciones
                }

            except PlaywrightTimeoutError as te:
                logger.error(f"Timeout durante el scraping de BICSA: {te}")
                try:
                    await page.screenshot(path="screenshot_bicsa_error.png")
                except Exception:
                    pass
                return {
                    "timestamp": datetime.now().isoformat(),
                    "total_instituciones": 0,
                    "execution_seconds": (datetime.now() - start_time).total_seconds(),
                    "status": "ERROR_TIMEOUT",
                    "error": str(te),
                    "data": []
                }
            except Exception as e:
                logger.error(f"Error inesperado durante el scraping: {e}")
                return {
                    "timestamp": datetime.now().isoformat(),
                    "total_instituciones": 0,
                    "execution_seconds": (datetime.now() - start_time).total_seconds(),
                    "status": "ERROR",
                    "error": str(e),
                    "data": []
                }
            finally:
                await browser.close()

    def _parse_html(self, html_content: str) -> List[Dict[str, Any]]:
        """
        Extrae la información de las instituciones financieras desde las tablas HTML de BICSA.
        Mapea dinámicamente las 7 categorías de estados.
        """
        soup = BeautifulSoup(html_content, "html.parser")
        instituciones = []

        tables = soup.find_all("table")
        logger.info(f"Se encontraron {len(tables)} tablas HTML en la página de BICSA.")

        for idx, table in enumerate(tables):
            rows = table.find_all("tr")
            if len(rows) <= 1:
                continue

            first_name = rows[1].find_all("td")[0].get_text(strip=True) if len(rows[1].find_all("td")) > 0 else "N/A"
            logger.info(f"Inspección de Tabla idx={idx+1}: Filas={len(rows)}, Primer Elemento={first_name}")

            # Evitar tablas maestras o de layout: si la tabla contiene otra tabla anidada, la omitimos
            if table.find("table"):
                logger.info(f"Omitiendo tabla idx={idx+1} porque contiene tablas anidadas (es layout).")
                continue

            categoria_detectada = "Activa"
            # Buscar el encabezado más cercano hacia arriba (límite de 15 nodos para evitar leer el menú principal o leyendas)
            textos_anteriores = table.find_all_previous(string=True)
            for text_node in textos_anteriores[:15]: 
                text_raw = text_node.strip()
                if not text_raw or len(text_raw) > 120 or len(text_raw) < 4:
                    continue
                    
                text_norm = text_raw.lower().replace("í", "i").replace("á", "a").replace("é", "e").replace("ó", "o").replace("ú", "u")
                
                if "limite" in text_norm:
                    categoria_detectada = "Activa (límite de consultas)"
                    break
                elif "excepcion" in text_norm:
                    categoria_detectada = "Con excepción de carga"
                    break
                elif "validacion" in text_norm:
                    categoria_detectada = "Validación de XML"
                    break
                elif "desvinculad" in text_norm:
                    categoria_detectada = "Desvinculada"
                    break
                elif "suspendida carga" in text_norm:
                    categoria_detectada = "Suspendida Carga"
                    break
                elif "suspendid" in text_norm:
                    categoria_detectada = "Suspendida"
                    break
                elif "bloquead" in text_norm:
                    categoria_detectada = "Bloqueada"
                    break
                elif "activa" in text_norm:
                    categoria_detectada = "Activa"
                    break

            for row in rows[1:]:
                cols = row.find_all("td")
                if not cols:
                    continue

                row_texts = []
                for c in cols:
                    text_val = c.get_text(strip=True)
                    if not text_val:
                        # Solo extraer de inputs si no hay texto visible (ej: cajas numéricas) y no es hidden
                        input_elem = c.find("input")
                        if input_elem and input_elem.get("type") != "hidden" and input_elem.get("value"):
                            text_val = input_elem.get("value").strip()
                    row_texts.append(text_val)
                
                # Eliminar columna inicial vacía (botón Modificar)
                if len(row_texts) > 1 and row_texts[0] == "":
                    row_texts = row_texts[1:]

                if len(row_texts) < 2:
                    continue

                nombre = row_texts[0].strip()[:245]
                
                if "HA OCURRIDO UN ERROR" in nombre.upper() or "CONTACTE A SU ADMINISTRADOR" in nombre.upper() or "☹" in nombre:
                    raise Exception("El portal de BICSA ha devuelto una página de error (posible cierre de sesión o timeout). Abortando.")

                if not nombre or len(nombre) > 200 or any(k in nombre.upper() for k in ["MODIFICAR", "NOMBRE INSTITUCIÓN", "SISTEMA BIC", "ESTADO INSTITUCIONES", "BÚSQUEDA"]):
                    continue

                # Extraer atributos
                cant_max = 0
                fecha_carga = None
                calidad = "N.A"
                motivo = None
                vencimiento = None

                for idx, val in enumerate(row_texts[1:]):
                    val_strip = val.strip() if val else ""
                    if not val_strip:
                        continue
                        
                    # Formato fecha DD/MM/YYYY
                    if re.match(r"^\d{2}/\d{2}/\d{4}$", val_strip):
                        try:
                            parts = val_strip.split("/")
                            formatted_date = f"{parts[2]}-{parts[1]}-{parts[0]} 12:00:00"
                        except Exception:
                            formatted_date = val_strip
                            
                        # Si es una fecha en un índice más alto en 'Validación de XML', probablemente sea el vencimiento
                        if idx >= 3 and categoria_detectada == "Validación de XML":
                            vencimiento = formatted_date
                        elif fecha_carga:
                            # Si ya tenemos una fecha de carga, la segunda fecha que encontremos la asumimos como vencimiento
                            vencimiento = formatted_date
                        else:
                            fecha_carga = formatted_date
                    elif val_strip.upper() in ["ALTA", "BAJA", "N/A", "N.A", "MEDIA"]:
                        calidad = val_strip.upper()
                    elif val_strip.replace('.', '').replace(',', '').isdigit() and len(val_strip) <= 12:
                        cant_max = int(val_strip.replace('.', '').replace(',', ''))
                    elif any(k in val_strip.lower() for k in ["gestión", "cese", "falta", "inconsistencia", "administrativa"]):
                        motivo = val_strip
                    elif "vencimiento" in val_strip.lower() or ("/" in val_strip and len(val_strip) > 10):
                        vencimiento = val_strip

                inst_item = {
                    "nombre": nombre,
                    "estado": categoria_detectada,
                    "cant_max_busquedas": cant_max,
                    "fecha_ultima_carga": fecha_carga,
                    "calidad_datos": calidad,
                    "motivo_suspension": motivo,
                    "vencimiento_validacion": vencimiento,
                    "categoria_tabla": categoria_detectada
                }

                instituciones.append(inst_item)

        return instituciones

    def _generate_mock_data(self, start_time: datetime) -> Dict[str, Any]:
        """Dataset de prueba"""
        now = datetime.now()
        mock_list = [
            {"nombre": "BANCO FINANCIERO DE CRÉDITO Y COMERCIO", "estado": "Activa", "cant_max_busquedas": 50000, "fecha_ultima_carga": now.strftime("%Y-%m-%d 20:15:00"), "calidad_datos": "Alta", "motivo_suspension": None, "vencimiento_validacion": None, "categoria_tabla": "Activa"},
            {"nombre": "COMPAÑÍA FINANCIERA DEL SUR S.A.", "estado": "Activa", "cant_max_busquedas": 25000, "fecha_ultima_carga": "2026-08-08 10:00:00", "calidad_datos": "Alta", "motivo_suspension": None, "vencimiento_validacion": None, "categoria_tabla": "Activa"},
            {"nombre": "CRÉDITO Y CAPITALES REGIONAL S.A.", "estado": "Bloqueada", "cant_max_busquedas": 10000, "fecha_ultima_carga": "2026-08-07 11:00:00", "calidad_datos": "Baja", "motivo_suspension": "Falta de actualización de XML superó las 72 horas hábiles", "vencimiento_validacion": None, "categoria_tabla": "Bloqueada"},
            {"nombre": "COOPERATIVA DE AHORRO Y CRÉDITO SAN MARTÍN", "estado": "Suspendida", "cant_max_busquedas": 15000, "fecha_ultima_carga": "2026-08-05 09:00:00", "calidad_datos": "Baja", "motivo_suspension": "Inconsistencias administrativas", "vencimiento_validacion": None, "categoria_tabla": "Suspendida"},
            {"nombre": "BANCO REGIONAL DE DESARROLLO", "estado": "Desvinculada", "cant_max_busquedas": 0, "fecha_ultima_carga": "2026-01-15 00:00:00", "calidad_datos": "N.A", "motivo_suspension": "Cese de operaciones BICSA", "vencimiento_validacion": None, "categoria_tabla": "Desvinculada"}
        ]
        return {"timestamp": datetime.now().isoformat(), "total_instituciones": len(mock_list), "execution_seconds": 0.45, "status": "SUCCESS_DEMO", "data": mock_list}

if __name__ == "__main__":
    scraper = BicsaScraper()
    result = asyncio.run(scraper.login_and_scrape())
    print(f"Resultado del Scraping: Status={result['status']}, Total={result['total_instituciones']}")
