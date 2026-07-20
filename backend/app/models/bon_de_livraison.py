from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import date, datetime, timezone


class BonDeLivraison(SQLModel, table=True):
    __tablename__ = "bons_de_livraison"

    id: Optional[int] = Field(default=None, primary_key=True)
    bl_number: str = Field(unique=True, index=True, max_length=20)
    date: date

    client_id: int = Field(foreign_key="clients.id", index=True)
    chauffeur_id: int = Field(foreign_key="chauffeurs.id", index=True)

    # Name snapshots (preserved if client/chauffeur is renamed)
    client_name: str = Field(max_length=100)
    client_code: Optional[str] = Field(default=None, max_length=20)
    client_category: str = Field(default="gros", max_length=20)
    chauffeur_name: str = Field(max_length=100)

    # Palettes plastique
    consigne_plastique: int = Field(default=0)      # sorties consignées
    nc_plastique: int = Field(default=0)            # sorties non-consignées
    retour_plastique: int = Field(default=0)        # retournées

    # Palettes bois
    consigne_bois: int = Field(default=0)
    nc_bois: int = Field(default=0)
    retour_bois: int = Field(default=0)

    notes: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class BLCreate(SQLModel):
    date: date
    client_id: int
    chauffeur_id: int
    consigne_plastique: int = 0
    nc_plastique: int = 0
    retour_plastique: int = 0
    consigne_bois: int = 0
    nc_bois: int = 0
    retour_bois: int = 0
    notes: Optional[str] = None


class BLUpdate(SQLModel):
    date: Optional[date] = None
    client_id: Optional[int] = None
    chauffeur_id: Optional[int] = None
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
    client_id: int
    chauffeur_id: int
    client_name: str
    client_code: Optional[str] = None
    client_category: str
    chauffeur_name: str
    consigne_plastique: int
    nc_plastique: int
    retour_plastique: int
    consigne_bois: int
    nc_bois: int
    retour_bois: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @property
    def total_plastique_sortie(self) -> int:
        return self.consigne_plastique + self.nc_plastique

    @property
    def total_bois_sortie(self) -> int:
        return self.consigne_bois + self.nc_bois
