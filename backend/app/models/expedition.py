from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import date, datetime, timezone


class Expedition(SQLModel, table=True):
    __tablename__ = "expeditions"

    id: Optional[int] = Field(default=None, primary_key=True)
    bl_number: str = Field(unique=True, index=True, max_length=50)
    date: date
    destination_type: str = Field(default="gros", max_length=20)  # gros | detail | horeca

    chauffeur_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    chauffeur_name: Optional[str] = Field(default=None, max_length=100)

    client_id: Optional[int] = Field(default=None, foreign_key="clients.id", index=True)
    client_name: Optional[str] = Field(default=None, max_length=100)
    client_code: Optional[str] = Field(default=None, max_length=20)

    livreur_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    livreur_name: Optional[str] = Field(default=None, max_length=100)

    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    created_by_name: Optional[str] = Field(default=None, max_length=100)

    # Palettes sent — set at creation, never modified
    nc_plastique: int = Field(default=0)
    nc_bois: int = Field(default=0)

    notes: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)

    # Gros return flag
    is_returned: bool = Field(default=False)
    returned_at: Optional[datetime] = Field(default=None)

    # Verification (détail/horeca only)
    retour_livreur_plastique: int = Field(default=0)
    retour_livreur_bois: int = Field(default=0)
    is_verified: bool = Field(default=False)
    verified_at: Optional[datetime] = Field(default=None)
    verified_by_name: Optional[str] = Field(default=None, max_length=100)
    livreur_confirmed: bool = Field(default=False)
    livreur_confirmed_at: Optional[datetime] = Field(default=None)


class ExpeditionCreate(SQLModel):
    bl_number: str
    date: date
    destination_type: str = "gros"
    chauffeur_id: Optional[int] = None
    client_id: Optional[int] = None
    livreur_id: Optional[int] = None
    client_ids: List[int] = []
    nc_plastique: int = 0
    nc_bois: int = 0
    notes: Optional[str] = None
    created_by_id: Optional[int] = None


class ExpeditionVerify(SQLModel):
    retour_livreur_plastique: int = 0
    retour_livreur_bois: int = 0
    verified_by_id: int


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
    chauffeur_id: Optional[int] = None
    chauffeur_name: Optional[str] = None
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
    created_by_name: Optional[str] = None
    retour_livreur_plastique: int = 0
    retour_livreur_bois: int = 0
    is_returned: bool = False
    returned_at: Optional[datetime] = None
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    verified_by_name: Optional[str] = None
    livreur_confirmed: bool = False
    livreur_confirmed_at: Optional[datetime] = None
