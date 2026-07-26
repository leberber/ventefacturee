from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import date, datetime, timezone


class Vente(SQLModel, table=True):
    __tablename__ = "ventes"

    id: Optional[int] = Field(default=None, primary_key=True)
    annee_mois: str = Field(max_length=7, index=True)  # "YYYY-MM"

    date_commande: Optional[date] = Field(default=None)
    num_commande: Optional[str] = Field(default=None, max_length=60)
    type_commande: Optional[str] = Field(default=None, max_length=30)

    # Client
    code_client: Optional[str] = Field(default=None, max_length=50)
    nom_client: Optional[str] = Field(default=None, max_length=150)
    categorie_client: Optional[str] = Field(default=None, max_length=20)
    route: Optional[str] = Field(default=None, max_length=50)
    commune: Optional[str] = Field(default=None, max_length=60)
    wilaya: Optional[str] = Field(default=None, max_length=60)
    zone: Optional[str] = Field(default=None, max_length=30)
    region: Optional[str] = Field(default=None, max_length=30)
    type_client: Optional[str] = Field(default=None, max_length=20)

    # FDV (Prévendeur)
    code_fdv: Optional[str] = Field(default=None, max_length=30)
    nom_fdv: Optional[str] = Field(default=None, max_length=100)
    type_fdv: Optional[str] = Field(default=None, max_length=30)
    code_sup: Optional[str] = Field(default=None, max_length=30)
    nom_sup: Optional[str] = Field(default=None, max_length=100)

    # Distribution
    code_distributeur: Optional[str] = Field(default=None, max_length=30)
    nom_distributeur: Optional[str] = Field(default=None, max_length=100)
    depot_livraison: Optional[str] = Field(default=None, max_length=50)
    statut_commande: Optional[str] = Field(default=None, max_length=30)
    date_facturation: Optional[date] = Field(default=None)

    # Product
    code_produit: Optional[str] = Field(default=None, max_length=30)
    description_produit: Optional[str] = Field(default=None, max_length=200)
    famille: Optional[str] = Field(default=None, max_length=50)
    sous_famille: Optional[str] = Field(default=None, max_length=80)
    uom_vente: Optional[str] = Field(default=None, max_length=20)

    # Quantities & amounts
    prix_unitaire: Optional[float] = Field(default=None)
    qte_commandee: Optional[float] = Field(default=None)
    qte_chargee: Optional[float] = Field(default=None)
    qte_livree: Optional[float] = Field(default=None)
    qte_facturee: Optional[float] = Field(default=None)
    total_commande: Optional[float] = Field(default=None)
    total_facture: Optional[float] = Field(default=None)
    total_remise: Optional[float] = Field(default=None)
    gratuite: Optional[float] = Field(default=None)

    # Metadata
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    uploaded_by_id: Optional[int] = Field(default=None, foreign_key="users.id")


class UploadResponse(SQLModel):
    lignes: int
    annee_mois: str
    message: str
