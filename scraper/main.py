import os
import sys
import logging
import asyncio
import requests
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from bicsa_scraper import BicsaScraper

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("scraper_service")

TIMEZONE_STR = os.getenv("TIMEZONE", "America/Argentina/Buenos_Aires")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

tz = pytz.timezone(TIMEZONE_STR)
scheduler = AsyncIOScheduler(timezone=tz)

DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

def _dia_habilitado_para_light() -> bool:
    """
    Consulta la configuración de días de la corrida LIGHT (Menú -> Configuración
    en el panel). Si el backend no responde (problema de red transitorio), se
    prefiere igual ejecutar el scraping para no perder datos por eso -- solo
    se omite la corrida cuando la configuración dice explícitamente que hoy
    no está habilitado.
    """
    try:
        res = requests.get(f"{BACKEND_URL}/api/v1/internal/configuracion-scraper", timeout=10)
        res.raise_for_status()
        config = res.json()
        dia_actual = DIAS_SEMANA[datetime.now(tz).weekday()]
        return bool(config.get(dia_actual, True))
    except Exception as e:
        logger.warning(f"No se pudo consultar la configuración de días del scraper, se ejecuta LIGHT de todos modos: {e}")
        return True

async def execute_scheduled_scrape(run_type: str = "FULL"):
    if run_type == "LIGHT" and not _dia_habilitado_para_light():
        logger.info("Corrida LIGHT omitida: hoy no está habilitado en la configuración del scraper.")
        return

    logger.info(f"===> Ejecutando Scraping Programado ({run_type}) - Horario Local: {datetime.now(tz)}")
    scraper = BicsaScraper()
    result = await scraper.login_and_scrape()

    # Enviar los resultados al servicio Backend para persistencia en BD
    try:
        backend_endpoint = f"{BACKEND_URL}/api/v1/internal/sync-scrape"
        payload = {
            "run_type": run_type,
            "scrape_result": result
        }
        logger.info(f"Enviando datos procesados al Backend: {backend_endpoint}")
        res = requests.post(backend_endpoint, json=payload, timeout=30)
        logger.info(f"Respuesta del backend: status={res.status_code}")
    except Exception as e:
        logger.error(f"Error al enviar datos de scraping al Backend: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializar Scheduler al arrancar el contenedor
    logger.info(f"Iniciando APScheduler con Zona Horaria {TIMEZONE_STR}...")
    
    # Configurar Tareas Cron
    # Full Scrape: 07:00 hs todos los días
    scheduler.add_job(
        execute_scheduled_scrape,
        CronTrigger(hour=7, minute=0, timezone=tz),
        kwargs={"run_type": "FULL"},
        id="full_daily_scrape",
        replace_existing=True
    )
    
    # Light Scrape: 16:00 hs, todos los días -- el filtro de qué días
    # efectivamente corre vive en la configuración (Menú -> Configuración en
    # el panel), consultada en cada disparo por _dia_habilitado_para_light().
    # El trigger dispara siempre para poder reaccionar a cambios de
    # configuración sin reiniciar este contenedor.
    scheduler.add_job(
        execute_scheduled_scrape,
        CronTrigger(hour=16, minute=0, timezone=tz),
        kwargs={"run_type": "LIGHT"},
        id="light_intraday_scrape",
        replace_existing=True
    )

    scheduler.start()
    logger.info("APScheduler iniciado con éxito.")
    yield
    logger.info("Deteniendo APScheduler...")
    scheduler.shutdown()

app = FastAPI(title="BICSA Scraper Service", version="1.0.0", lifespan=lifespan)

class ManualTriggerRequest(BaseModel):
    run_type: str = "MANUAL"

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "scraper",
        "timestamp": datetime.now(tz).isoformat(),
        "scheduled_jobs": [job.id for job in scheduler.get_jobs()]
    }

@app.post("/trigger-scrape")
async def trigger_scrape_manual(background_tasks: BackgroundTasks, req: ManualTriggerRequest = ManualTriggerRequest()):
    logger.info(f"Recibida solicitud manual de scraping (Tipo: {req.run_type})")
    background_tasks.add_task(execute_scheduled_scrape, req.run_type)
    return {
        "status": "PROCESSING",
        "message": f"Scraping {req.run_type} iniciado en segundo plano.",
        "timestamp": datetime.now(tz).isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
