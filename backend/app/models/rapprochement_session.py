from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from sqlmodel import SQLModel, Field


class RapprochementSession(SQLModel, table=True):
    __tablename__ = "rapprochement_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    nom_livreur: str = Field(max_length=200)
    date_bl: str = Field(max_length=20)
    source: Optional[str] = Field(default=None, max_length=100)
    net_a_payer: float
    net_ajuste: float
    total_discount: float = 0.0
    montant_recu: Optional[float] = None
    difference: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RapprochementSessionLigne(SQLModel, table=True):
    __tablename__ = "rapprochement_session_lignes"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="rapprochement_sessions.id", index=True)
    code_produit: str = Field(max_length=50)
    libelle: str = Field(max_length=200)
    bl_qte_unites: float
    bl_nb_colis: Optional[float] = None
    bl_prix_unitaire: float
    bl_montant_ttc: float
    net_ligne: float
    ventes_qte_colis: Optional[float] = None
    match: bool = False
    is_duplicate: bool = False
    ref_price: Optional[float] = None
    prix_promotion: Optional[float] = None
    qty_promo: int = 0
    qty_gros: int = 0
    promo_prix_override: Optional[float] = None


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SessionLigneCreate(SQLModel):
    code_produit: str
    libelle: str
    bl_qte_unites: float
    bl_nb_colis: Optional[float] = None
    bl_prix_unitaire: float
    bl_montant_ttc: float
    net_ligne: float
    ventes_qte_colis: Optional[float] = None
    match: bool
    is_duplicate: bool = False
    ref_price: Optional[float] = None
    prix_promotion: Optional[float] = None
    qty_promo: int = 0
    qty_gros: int = 0
    promo_prix_override: Optional[float] = None


class SessionCreate(SQLModel):
    nom_livreur: str
    date_bl: str
    source: Optional[str] = None
    net_a_payer: float
    net_ajuste: float
    total_discount: float = 0.0
    montant_recu: Optional[float] = None
    difference: Optional[float] = None
    lignes: List[SessionLigneCreate]


class SessionLigneRead(SQLModel):
    id: int
    code_produit: str
    libelle: str
    bl_qte_unites: float
    bl_nb_colis: Optional[float]
    bl_prix_unitaire: float
    bl_montant_ttc: float
    net_ligne: float
    ventes_qte_colis: Optional[float]
    match: bool
    is_duplicate: bool
    ref_price: Optional[float]
    prix_promotion: Optional[float]
    qty_promo: int
    qty_gros: int
    promo_prix_override: Optional[float]


class SessionRead(SQLModel):
    id: int
    nom_livreur: str
    date_bl: str
    source: Optional[str]
    net_a_payer: float
    net_ajuste: float
    total_discount: float
    montant_recu: Optional[float]
    difference: Optional[float]
    created_at: datetime


class SessionReadDetail(SessionRead):
    lignes: List[SessionLigneRead]
