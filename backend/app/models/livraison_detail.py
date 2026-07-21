from sqlmodel import SQLModel, Field, UniqueConstraint
from typing import Optional, List
from datetime import datetime, timezone


class ExpeditionClient(SQLModel, table=True):
    __tablename__ = "expedition_clients"
    __table_args__ = (UniqueConstraint("expedition_id", "client_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    expedition_id: int = Field(foreign_key="expeditions.id", index=True)
    client_id: int = Field(foreign_key="clients.id")
    client_name: str = Field(max_length=150)
    client_code: Optional[str] = Field(default=None, max_length=20)


class LivraisonDetail(SQLModel, table=True):
    __tablename__ = "livraison_details"
    __table_args__ = (UniqueConstraint("expedition_id", "client_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    expedition_id: int = Field(foreign_key="expeditions.id", index=True)
    client_id: int = Field(foreign_key="clients.id")
    client_name: str = Field(max_length=150)
    client_code: Optional[str] = Field(default=None, max_length=20)
    plastique: int = Field(default=0)
    bois: int = Field(default=0)
    retour_plastique: int = Field(default=0)
    retour_bois: int = Field(default=0)
    notes: Optional[str] = Field(default=None, max_length=500)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


# --- Schemas ---

class LivraisonDetailCreate(SQLModel):
    client_id: int
    plastique: int = 0
    bois: int = 0
    retour_plastique: int = 0
    retour_bois: int = 0
    notes: Optional[str] = None


class LivraisonDetailRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    expedition_id: int
    client_id: int
    client_name: str
    client_code: Optional[str] = None
    plastique: int
    bois: int
    retour_plastique: int
    retour_bois: int
    notes: Optional[str] = None
    recorded_at: datetime
    updated_at: Optional[datetime] = None


class ExpeditionClientRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    expedition_id: int
    client_id: int
    client_name: str
    client_code: Optional[str] = None
    detail: Optional[LivraisonDetailRead] = None
