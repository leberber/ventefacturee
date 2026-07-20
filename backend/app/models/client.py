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
    name: str = Field(max_length=100, index=True)
    phone: Optional[str] = Field(default=None, max_length=20)
    category: ClientCategory = Field(default=ClientCategory.GROS)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class ClientCreate(SQLModel):
    code: Optional[str] = None
    name: str
    phone: Optional[str] = None
    category: ClientCategory = ClientCategory.GROS


class ClientUpdate(SQLModel):
    code: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[ClientCategory] = None
    is_active: Optional[bool] = None


class ClientRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    code: Optional[str] = None
    name: str
    phone: Optional[str] = None
    category: ClientCategory
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Computed from BL history
    plastic_balance: Optional[int] = None       # total en circulation
    plastic_consigne: Optional[int] = None      # sent with consigne
    plastic_nc: Optional[int] = None            # sent non-consignées
    wood_balance: Optional[int] = None
    wood_consigne: Optional[int] = None
    wood_nc: Optional[int] = None
