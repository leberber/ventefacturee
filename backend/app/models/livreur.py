from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


class Livreur(SQLModel, table=True):
    __tablename__ = "livreurs"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, index=True)
    phone: Optional[str] = Field(default=None, max_length=20)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class LivreurCreate(SQLModel):
    name: str
    phone: Optional[str] = None


class LivreurUpdate(SQLModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class LivreurRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
