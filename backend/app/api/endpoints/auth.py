from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.institucion import Usuario
from app.schemas.auth import Token, UserResponse, UserCreate
from app.core.security import verify_password, create_access_token, get_password_hash, get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.es_activo:
        raise HTTPException(status_code=400, detail="Usuario inactivo en el sistema")

    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_email": user.email,
        "nombre_completo": user.nombre_completo
    }

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
