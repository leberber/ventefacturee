from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import date, datetime, timezone


class Retour(SQLModel, table=True):
    __tablename__ = "retours"

    id: Optional[int] = Field(default=None, primary_key=True)
    expedition_id: int = Field(foreign_key="expeditions.id", index=True)
    date: date
    retour_plastique: int = Field(default=0)
    consigne_paid_plastique: int = Field(default=0)
    palette_dette_plastique: int = Field(default=0)
    retour_bois: int = Field(default=0)
    consigne_paid_bois: int = Field(default=0)
    palette_dette_bois: int = Field(default=0)
    notes: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RetourCreate(SQLModel):
    date: date
    retour_plastique: int = 0
    consigne_paid_plastique: int = 0
    retour_bois: int = 0
    consigne_paid_bois: int = 0
    notes: Optional[str] = None


class RetourRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    expedition_id: int
    date: date
    retour_plastique: int
    consigne_paid_plastique: int
    palette_dette_plastique: int
    retour_bois: int
    consigne_paid_bois: int
    palette_dette_bois: int
    notes: Optional[str] = None
    created_at: datetime
