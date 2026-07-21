from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import date, datetime, timezone


class Expedition(SQLModel, table=True):
    __tablename__ = "expeditions"

    id: Optional[int] = Field(default=None, primary_key=True)
    bl_number: str = Field(unique=True, index=True, max_length=50)
    date: date
    destination_type: str = Field(default="gros", max_length=20)  # gros | detail | horeca

    chauffeur_id: int = Field(foreign_key="chauffeurs.id", index=True)
    chauffeur_name: str = Field(max_length=100)

    client_id: Optional[int] = Field(default=None, foreign_key="clients.id", index=True)
    client_name: Optional[str] = Field(default=None, max_length=100)
    client_code: Optional[str] = Field(default=None, max_length=20)

    livreur_id: Optional[int] = Field(default=None, foreign_key="livreurs.id", index=True)
    livreur_name: Optional[str] = Field(default=None, max_length=100)

    # Palettes sent — set at creation, never modified
    nc_plastique: int = Field(default=0)
    nc_bois: int = Field(default=0)

    notes: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class ExpeditionCreate(SQLModel):
    bl_number: str
    date: date
    destination_type: str = "gros"
    chauffeur_id: int
    client_id: Optional[int] = None
    livreur_id: Optional[int] = None
    client_ids: List[int] = []
    nc_plastique: int = 0
    nc_bois: int = 0
    notes: Optional[str] = None


class ExpeditionUpdate(SQLModel):
    date: Optional[date] = None
    chauffeur_id: Optional[int] = None
    client_id: Optional[int] = None
    livreur_id: Optional[int] = None
    nc_plastique: Optional[int] = None
    nc_bois: Optional[int] = None
    notes: Optional[str] = None


class ExpeditionRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    bl_number: str
    date: date
    destination_type: str
    chauffeur_id: int
    chauffeur_name: str
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_code: Optional[str] = None
    livreur_id: Optional[int] = None
    livreur_name: Optional[str] = None
    nc_plastique: int
    nc_bois: int
    retour_plastique: int = 0        # computed from retours table
    consigne_paid_plastique: int = 0 # computed from retours table
    palette_dette_plastique: int = 0 # computed from retours table
    retour_bois: int = 0             # computed from retours table
    consigne_paid_bois: int = 0      # computed from retours table
    palette_dette_bois: int = 0      # computed from retours table
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
