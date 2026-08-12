from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str
    user_email: str
    nombre_completo: str | None = None

class TokenData(BaseModel):
    email: str | None = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nombre_completo: str | None = None
    es_admin: bool = False

class UserResponse(BaseModel):
    id: int
    email: str
    nombre_completo: str | None = None
    es_activo: bool
    es_admin: bool

    class Config:
        from_attributes = True
