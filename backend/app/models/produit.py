from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import datetime, timezone


class Produit(SQLModel, table=True):
    __tablename__ = "produits"

    code_produit: str = Field(primary_key=True, max_length=30)
    description_produit: Optional[str] = Field(default=None, max_length=200)
    famille: Optional[str] = Field(default=None, max_length=50)
    sous_famille: Optional[str] = Field(default=None, max_length=80)
    uom_vente: Optional[str] = Field(default=None, max_length=20)
    uom_principale: Optional[str] = Field(default=None, max_length=20)

    # Enrichment
    nom_produit: Optional[str] = Field(default=None, max_length=200)
    colisage: Optional[float] = Field(default=None)
    colisage_palette: Optional[int] = Field(default=None)
    unite: Optional[str] = Field(default=None, max_length=10)
    volume: Optional[float] = Field(default=None)
    poids_unite_vente: Optional[float] = Field(default=None)
    prix: Optional[float] = Field(default=None)
    facturable: bool = Field(default=True)
    imported: bool = Field(default=False)

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProduitRead(SQLModel):
    model_config = {"from_attributes": True}

    code_produit: str
    description_produit: Optional[str] = None
    famille: Optional[str] = None
    sous_famille: Optional[str] = None
    uom_vente: Optional[str] = None
    uom_principale: Optional[str] = None
    nom_produit: Optional[str] = None
    colisage: Optional[float] = None
    colisage_palette: Optional[int] = None
    unite: Optional[str] = None
    volume: Optional[float] = None
    poids_unite_vente: Optional[float] = None
    prix: Optional[float] = None
    facturable: bool = True
    imported: bool = False
    updated_at: datetime


class ProduitUpdate(SQLModel):
    nom_produit: Optional[str] = None
    colisage: Optional[float] = None
    colisage_palette: Optional[int] = None
    unite: Optional[str] = None
    volume: Optional[float] = None
    poids_unite_vente: Optional[float] = None
    prix: Optional[float] = None
    facturable: Optional[bool] = None
    imported: Optional[bool] = None


class ProduitPage(SQLModel):
    total: int
    items: List[ProduitRead]
