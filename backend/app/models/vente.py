from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import date, datetime, timezone


class Vente(SQLModel, table=True):
    __tablename__ = "ventes"

    id: Optional[int] = Field(default=None, primary_key=True)
    annee_mois: str = Field(max_length=7, index=True)  # "YYYY-MM"

    # Order
    date_commande: Optional[date] = Field(default=None)
    num_commande: Optional[str] = Field(default=None, max_length=60)
    type_commande: Optional[str] = Field(default=None, max_length=30)
    source: Optional[str] = Field(default=None, max_length=30)

    # Client
    code_client: Optional[str] = Field(default=None, max_length=50)
    nom_client: Optional[str] = Field(default=None, max_length=150)
    categorie_client: Optional[str] = Field(default=None, max_length=20)
    adresse_client: Optional[str] = Field(default=None, max_length=200)
    route: Optional[str] = Field(default=None, max_length=50)
    commune: Optional[str] = Field(default=None, max_length=60)
    wilaya: Optional[str] = Field(default=None, max_length=60)
    zone: Optional[str] = Field(default=None, max_length=30)
    region: Optional[str] = Field(default=None, max_length=30)
    tel_client: Optional[str] = Field(default=None, max_length=30)
    type_client: Optional[str] = Field(default=None, max_length=20)

    # FDV (Prévendeur)
    code_fdv: Optional[str] = Field(default=None, max_length=30)
    nom_fdv: Optional[str] = Field(default=None, max_length=100)
    type_fdv: Optional[str] = Field(default=None, max_length=30)
    code_sup: Optional[str] = Field(default=None, max_length=30)
    nom_sup: Optional[str] = Field(default=None, max_length=100)

    # Distribution
    buid: Optional[str] = Field(default=None, max_length=30)
    code_distributeur: Optional[str] = Field(default=None, max_length=30)
    nom_distributeur: Optional[str] = Field(default=None, max_length=100)
    depot_livraison: Optional[str] = Field(default=None, max_length=50)
    statut_commande: Optional[str] = Field(default=None, max_length=30)
    date_creation: Optional[date] = Field(default=None)
    date_confirmation: Optional[date] = Field(default=None)
    date_facturation: Optional[date] = Field(default=None)
    code_livreur: Optional[str] = Field(default=None, max_length=30)
    nom_livreur: Optional[str] = Field(default=None, max_length=100)
    matricule_van: Optional[str] = Field(default=None, max_length=30)

    # Product
    code_produit: Optional[str] = Field(default=None, max_length=30)
    description_produit: Optional[str] = Field(default=None, max_length=200)
    famille: Optional[str] = Field(default=None, max_length=50)
    sous_famille: Optional[str] = Field(default=None, max_length=80)
    uom_vente: Optional[str] = Field(default=None, max_length=20)
    cout_produit: Optional[float] = Field(default=None)
    prix_unitaire: Optional[float] = Field(default=None)
    uom_principale: Optional[str] = Field(default=None, max_length=20)
    prix_unitaire_uom_pr: Optional[float] = Field(default=None)

    # Quantities & amounts
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


class VenteRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    annee_mois: str
    date_commande: Optional[date] = None
    num_commande: Optional[str] = None
    type_commande: Optional[str] = None
    source: Optional[str] = None
    code_client: Optional[str] = None
    nom_client: Optional[str] = None
    categorie_client: Optional[str] = None
    adresse_client: Optional[str] = None
    route: Optional[str] = None
    commune: Optional[str] = None
    wilaya: Optional[str] = None
    zone: Optional[str] = None
    region: Optional[str] = None
    tel_client: Optional[str] = None
    type_client: Optional[str] = None
    code_fdv: Optional[str] = None
    nom_fdv: Optional[str] = None
    buid: Optional[str] = None
    depot_livraison: Optional[str] = None
    statut_commande: Optional[str] = None
    date_creation: Optional[date] = None
    date_confirmation: Optional[date] = None
    date_facturation: Optional[date] = None
    code_livreur: Optional[str] = None
    nom_livreur: Optional[str] = None
    matricule_van: Optional[str] = None
    code_produit: Optional[str] = None
    description_produit: Optional[str] = None
    famille: Optional[str] = None
    sous_famille: Optional[str] = None
    uom_vente: Optional[str] = None
    cout_produit: Optional[float] = None
    prix_unitaire: Optional[float] = None
    uom_principale: Optional[str] = None
    prix_unitaire_uom_pr: Optional[float] = None
    qte_commandee: Optional[float] = None
    qte_chargee: Optional[float] = None
    qte_livree: Optional[float] = None
    qte_facturee: Optional[float] = None
    total_commande: Optional[float] = None
    total_facture: Optional[float] = None
    total_remise: Optional[float] = None
    gratuite: Optional[float] = None


class VentePage(SQLModel):
    total: int
    items: List[VenteRead]


class UploadResponse(SQLModel):
    lignes: int
    annee_mois: str
    message: str
