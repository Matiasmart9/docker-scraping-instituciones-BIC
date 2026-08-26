import os
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.db.session import engine, Base, SessionLocal
from app.models.institucion import Usuario, Institucion, EstadoActual
from app.core.security import get_password_hash
from app.api.endpoints import auth, instituciones, sync, contactos, notificaciones
from app.services.business_logic import evaluar_nivel_alerta
from app.core.firebase_config import init_firebase

init_firebase()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend_app")

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

ADMIN_USER = os.getenv("ADMIN_INITIAL_USER", "admin@bicsasatelite.com")
ADMIN_PASS = os.getenv("ADMIN_INITIAL_PASSWORD", "AdminPassword2026!")

def init_db_seeds(db: Session):
    # 1. Crear tablas en la BD
    Base.metadata.create_all(bind=engine)
    
    # 1.5. Aplicar parche para agregar columnas si faltan en BD existentes
    from sqlalchemy import text
    try:
        db.execute(text("ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS telefonos_contacto VARCHAR[] DEFAULT '{}';"))
        db.commit()
    except Exception as e:
        logger.error(f"Error agregando telefonos_contacto: {e}")
        db.rollback()
    
    try:
        db.execute(text("ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS contacto_actualizado_en TIMESTAMP WITH TIME ZONE;"))
        db.commit()
    except Exception as e:
        logger.error(f"Error agregando contacto_actualizado_en: {e}")
        db.rollback()

    try:
        db.execute(text("ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS contacto_actualizado_por VARCHAR(255);"))
        db.commit()
    except Exception as e:
        logger.error(f"Error agregando contacto_actualizado_por: {e}")
        db.rollback()

    # 2. Crear usuario Admin por defecto
    user = db.query(Usuario).filter(Usuario.email == ADMIN_USER).first()
    if not user:
        logger.info(f"Creando usuario administrador inicial: {ADMIN_USER}")
        admin_user = Usuario(
            email=ADMIN_USER,
            hashed_password=get_password_hash(ADMIN_PASS),
            nombre_completo="Administrador Satélite BICSA",
            es_activo=True,
            es_admin=True
        )
        db.add(admin_user)
        db.commit()

    # 3. Actualizar niveles de alerta para registros de la BD
    logger.info("Actualizando niveles de alerta para registros existentes...")
    estados = db.query(EstadoActual).all()
    for e in estados:
        hrs_trans, hrs_rest, nivel = evaluar_nivel_alerta(e.estado, e.fecha_ultima_carga)
        e.horas_habiles_transcurridas = hrs_trans
        e.horas_habiles_restantes = hrs_rest
        e.nivel_alerta = nivel
    db.commit()
    logger.info("Niveles de alerta recalculados correctamente.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Inicializando backend API y base de datos...")
    db = SessionLocal()
    try:
        init_db_seeds(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="BICSA Satélite API",
    description="API Backend para el Portal Satélite de Monitoreo de Estado de Instituciones (BICSA)",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Configurar CORS
FRONTEND_URLS = [
    "http://localhost:3000",
    "http://141.148.159.57",
    "http://141.148.159.57:3000",
    "https://141.148.159.57"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type"]
)

# Registrar Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(instituciones.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(contactos.router)
app.include_router(notificaciones.router)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "backend", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
