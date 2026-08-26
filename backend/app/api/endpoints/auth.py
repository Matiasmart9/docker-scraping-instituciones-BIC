from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.institucion import Usuario
from app.schemas.auth import Token, UserResponse, UserCreate
from app.core.security import verify_password, create_access_token, get_password_hash, get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login", response_model=Token)
def login_for_access_token():
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="La autenticación se realiza ahora directamente contra Firebase en el frontend."
    )

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
