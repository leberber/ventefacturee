from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import date, datetime, timezone


class BonDeLivraison(SQLModel, table=True):
    __tablename__ = "bons_de_livraison"

    id: Optional[int] = Field(default=None, primary_key=True)
    bl_number: str = Field(unique=True, index=True, max_length=20)
    date: date
    destination_type: str = Field(default="gros", max_length=20)  # gros | detail | horeca

    chauffeur_id: int = Field(foreign_key="chauffeurs.id", index=True)
    chauffeur_name: str = Field(max_length=100)

    # For gros: client is known at time of BL
    client_id: Optional[int] = Field(default=None, foreign_key="clients.id", index=True)
    client_name: Optional[str] = Field(default=None, max_length=100)
    client_code: Optional[str] = Field(default=None, max_length=20)

    # For detail/horeca: pallets go to livreur first, assigned to clients later
    livreur_id: Optional[int] = Field(default=None, foreign_key="livreurs.id", index=True)
    livreur_name: Optional[str] = Field(default=None, max_length=100)

    # Palettes plastique
    consigne_plastique: int = Field(default=0)
    nc_plastique: int = Field(default=0)
    retour_plastique: int = Field(default=0)

    # Palettes bois
    consigne_bois: int = Field(default=0)
    nc_bois: int = Field(default=0)
    retour_bois: int = Field(default=0)

    notes: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class BLCreate(SQLModel):
    bl_number: str
    date: date
    destination_type: str = "gros"       # gros | detail | horeca
    chauffeur_id: int
    client_id: Optional[int] = None      # required if destination_type == gros
    livreur_id: Optional[int] = None     # required if destination_type in [detail, horeca]
    client_ids: List[int] = []           # planned clients for detail/horeca expeditions
    consigne_plastique: int = 0
    nc_plastique: int = 0
    retour_plastique: int = 0
    consigne_bois: int = 0
    nc_bois: int = 0
    retour_bois: int = 0
    notes: Optional[str] = None


class BLUpdate(SQLModel):
    date: Optional[date] = None
    chauffeur_id: Optional[int] = None
    client_id: Optional[int] = None
    livreur_id: Optional[int] = None
    consigne_plastique: Optional[int] = None
    nc_plastique: Optional[int] = None
    retour_plastique: Optional[int] = None
    consigne_bois: Optional[int] = None
    nc_bois: Optional[int] = None
    retour_bois: Optional[int] = None
    notes: Optional[str] = None


class BLRead(SQLModel):
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
    consigne_plastique: int
    nc_plastique: int
    retour_plastique: int
    consigne_bois: int
    nc_bois: int
    retour_bois: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
