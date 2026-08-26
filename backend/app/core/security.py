import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db

SECRET_KEY = os.getenv("SECRET_KEY", "bicsa_super_secret_jwt_key_change_in_production_2026!")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

from firebase_admin import auth as firebase_auth

import logging
logger = logging.getLogger(__name__)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app.models.institucion import Usuario
    try:
        # Validar token con Firebase Admin SDK
        decoded_token = firebase_auth.verify_id_token(token)
        email = decoded_token.get("email")
        if not email:
            raise ValueError("Token no contiene email")
    except Exception as e:
        logger.error(f"Error de validación Firebase: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Error validando token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Buscar el usuario en la base de datos local para la relación con SQLAlchemy
    user = db.query(Usuario).filter(Usuario.email == email).first()
    
    if user is None:
        # Si el usuario se logueó exitosamente por Firebase pero no existe en nuestra DB,
        # lo creamos automáticamente para no romper la app (opcional, o lanzar error).
        user = Usuario(
            email=email,
            nombre_completo=decoded_token.get("name", "Usuario Firebase"),
            hashed_password="firebase_managed_no_local_password"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    return user
