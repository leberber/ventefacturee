from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class UserRole(str, Enum):
    ADMIN    = "admin"
    EMPLOYE  = "employe"
    LIVREUR  = "livreur"
    CHAUFFEUR = "chauffeur"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    phone: str = Field(max_length=20, index=True, unique=True)
    full_name: str = Field(max_length=100)
    hashed_password: str = Field(max_length=200)
    role: UserRole = Field(default=UserRole.EMPLOYE)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(SQLModel):
    phone: str
    full_name: str
    password: str
    role: UserRole = UserRole.EMPLOYE


class UserUpdate(SQLModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    phone: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
