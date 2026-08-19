import os
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db.session import engine, Base, SessionLocal
from app.models.institucion import Usuario, Institucion, EstadoActual
from app.core.security import get_password_hash
from app.api.endpoints import auth, instituciones, sync, contactos, notificaciones
from app.services.business_logic import evaluar_nivel_alerta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend_app")

ADMIN_USER = os.getenv("ADMIN_INITIAL_USER", "admin@bicsasatelite.com")
ADMIN_PASS = os.getenv("ADMIN_INITIAL_PASSWORD", "AdminPassword2026!")

def init_db_seeds(db: Session):
    # 1. Crear tablas en la BD
    Base.metadata.create_all(bind=engine)
    
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

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
