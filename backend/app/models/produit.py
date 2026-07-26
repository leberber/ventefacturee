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
    colisage: Optional[float] = Field(default=None)

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProduitRead(SQLModel):
    model_config = {"from_attributes": True}

    code_produit: str
    description_produit: Optional[str] = None
    famille: Optional[str] = None
    sous_famille: Optional[str] = None
    uom_vente: Optional[str] = None
    uom_principale: Optional[str] = None
    colisage: Optional[float] = None
    updated_at: datetime


class ProduitUpdate(SQLModel):
    colisage: Optional[float] = None


class ProduitPage(SQLModel):
    total: int
    items: List[ProduitRead]
