import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Float, ARRAY
from sqlalchemy.orm import relationship
from app.db.session import Base

class Institucion(Base):
    __tablename__ = "instituciones"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), unique=True, index=True, nullable=False)
    codigo_bicsa = Column(String(100), nullable=True)
    creado_el = Column(DateTime, default=datetime.datetime.utcnow)

    estado_actual = relationship("EstadoActual", back_populates="institucion", uselist=False, cascade="all, delete-orphan")
    snapshots = relationship("SnapshotDiario", back_populates="institucion", cascade="all, delete-orphan")
    historial = relationship("HistorialCambios", back_populates="institucion", cascade="all, delete-orphan")

    # Datos de contacto para recordatorios (WhatsApp)
    telefonos_contacto = Column(ARRAY(String), default=list)
    contacto_actualizado_en = Column(DateTime(timezone=True), nullable=True)
    contacto_actualizado_por = Column(String(255), nullable=True)
    
    # Manejo de cambios de nombre en el portal
    alias_nombres = Column(ARRAY(String), default=list)

class EstadoActual(Base):
    __tablename__ = "estado_actual"

    id = Column(Integer, primary_key=True, index=True)
    institucion_id = Column(Integer, ForeignKey("instituciones.id"), unique=True, nullable=False)
    estado = Column(String(100), nullable=False)
    cant_max_busquedas = Column(Integer, default=0)
    fecha_ultima_carga = Column(String(100), nullable=True)
    calidad_datos = Column(String(50), nullable=True)
    motivo_suspension = Column(Text, nullable=True)
    vencimiento_validacion = Column(String(100), nullable=True)
    categoria_tabla = Column(String(100), nullable=False)
    actualizado_el = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Campos calculados de riesgo
    horas_habiles_transcurridas = Column(Float, default=0.0)
    horas_habiles_restantes = Column(Float, default=72.0)
    nivel_alerta = Column(String(20), default="NORMAL") # NORMAL, ADVERTENCIA, CRITICO, BLOQUEADO

    institucion = relationship("Institucion", back_populates="estado_actual")

class SnapshotDiario(Base):
    __tablename__ = "snapshot_diario"

    id = Column(Integer, primary_key=True, index=True)
    institucion_id = Column(Integer, ForeignKey("instituciones.id"), nullable=False)
    fecha_snapshot = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    estado = Column(String(100), nullable=False)
    cant_max_busquedas = Column(Integer, default=0)
    fecha_ultima_carga = Column(String(100), nullable=True)
    calidad_datos = Column(String(50), nullable=True)
    motivo_suspension = Column(Text, nullable=True)
    vencimiento_validacion = Column(String(100), nullable=True)
    categoria_tabla = Column(String(100), nullable=False)

    institucion = relationship("Institucion", back_populates="snapshots")

class HistorialCambios(Base):
    __tablename__ = "historial_cambios"

    id = Column(Integer, primary_key=True, index=True)
    institucion_id = Column(Integer, ForeignKey("instituciones.id"), nullable=False)
    estado_anterior = Column(String(100), nullable=True)
    estado_nuevo = Column(String(100), nullable=False)
    fecha_deteccion = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    corrida_origen = Column(String(50), default="FULL") # FULL, LIGHT, MANUAL
    detalle_cambio = Column(Text, nullable=True)

    institucion = relationship("Institucion", back_populates="historial")

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    nombre_completo = Column(String(255), nullable=True)
    es_activo = Column(Boolean, default=True)
    es_admin = Column(Boolean, default=False)
    creado_el = Column(DateTime, default=datetime.datetime.utcnow)

class RegistroUnificacion(Base):
    __tablename__ = "registro_unificacion"

    id = Column(Integer, primary_key=True, index=True)
    institucion_antigua_nombre = Column(String(255), nullable=False)
    institucion_nueva_id = Column(Integer, ForeignKey("instituciones.id"), nullable=False)
    institucion_nueva_nombre = Column(String(255), nullable=False)
    fecha_unificacion = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    usuario_email = Column(String(255), nullable=False)
    
    institucion_nueva = relationship("Institucion")
