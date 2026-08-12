import asyncio
import os
import logging
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_azure")

USER = os.getenv("BICSA_USER", "")
PASS = os.getenv("BICSA_PASSWORD", "")
BASE_URL = os.getenv("BICSA_BASE_URL", "https://bicquerywebapp.azurewebsites.net")

async def run():
    logger.info(f"Probando login en Azure AD para usuario: {USER}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context()
        page = await context.new_page()

        logger.info(f"Navegando a {BASE_URL}...")
        await page.goto(BASE_URL, wait_until="networkidle")
        logger.info(f"URL Actual: {page.url}")

        if "login.microsoftonline.com" in page.url or "login.live.com" in page.url:
            logger.info("Detectado portal de autenticación Azure AD / Microsoft SSO.")
            
            # 1. Email / Usuario
            logger.info("Esperando campo de correo/usuario (loginfmt)...")
            await page.wait_for_selector("input[name='loginfmt']", timeout=15000)
            await page.fill("input[name='loginfmt']", USER)
            logger.info("Correo ingresado. Clic en Siguiente...")
            await page.click("input[id='idSIButton9']")

            # 2. Contraseña
            logger.info("Esperando campo de contraseña (passwd)...")
            await page.wait_for_selector("input[name='passwd']", timeout=15000)
            await page.fill("input[name='passwd']", PASS)
            logger.info("Contraseña ingresada. Clic en Iniciar sesión...")
            await page.click("input[id='idSIButton9']")

            # 3. Pregunta "¿Desea mantener la sesión iniciada?"
            try:
                logger.info("Verificando diálogo 'Mantener sesión iniciada'...")
                await page.wait_for_selector("input[id='idSIButton9']", timeout=8000)
                logger.info("Confirmando 'Sí' en diálogo de sesión...")
                await page.click("input[id='idSIButton9']")
            except Exception as e:
                logger.info(f"Omitiendo diálogo de permanencia: {e}")

            await page.wait_for_load_state("networkidle", timeout=30000)
            logger.info(f"URL post-autenticación Azure AD: {page.url}")

        # Navegar a la pantalla de instituciones
        target_url = f"{BASE_URL.rstrip('/')}/Instituciones_Estado.aspx"
        logger.info(f"Navegando a {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        logger.info(f"URL Final: {page.url}")
        logger.info(f"Título de la página: {await page.title()}")

        content = await page.content()
        with open("real_bicsa_page.html", "w", encoding="utf-8") as f:
            f.write(content)

        logger.info(f"Página HTML obtenida con éxito. Longitud: {len(content)} bytes")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
