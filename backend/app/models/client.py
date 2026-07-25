from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class ClientCategory(str, Enum):
    GROS = "gros"
    DETAIL = "detail"
    HORECA = "horeca"


class Client(SQLModel, table=True):
    __tablename__ = "clients"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: Optional[str] = Field(default=None, max_length=20, index=True)
    name: str = Field(max_length=150, index=True)          # Nom magasin / display
    first_name: Optional[str] = Field(default=None, max_length=60)
    last_name: Optional[str] = Field(default=None, max_length=60)
    store_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    category: ClientCategory = Field(default=ClientCategory.GROS)
    daira: Optional[str] = Field(default=None, max_length=60)
    commune: Optional[str] = Field(default=None, max_length=60)
    address: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class ClientCreate(SQLModel):
    code: Optional[str] = None
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    category: ClientCategory = ClientCategory.GROS
    daira: Optional[str] = None
    commune: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ClientUpdate(SQLModel):
    code: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[ClientCategory] = None
    daira: Optional[str] = None
    commune: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None


class ClientRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    code: Optional[str] = None
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    category: ClientCategory
    daira: Optional[str] = None
    commune: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
