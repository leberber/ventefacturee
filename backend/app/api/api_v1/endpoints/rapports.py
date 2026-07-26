from typing import Any, List, Optional
from collections import defaultdict
from datetime import date, timedelta
import calendar

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.vente import Vente
from app.models.produit import Produit

router = APIRouter()

FAMILLES_RAPPORT = ['sucre', 'huile']




@router.get("/facturation-clients", response_model=List[str])
def list_facturation_clients(
    annee_mois: str = Query(...),
    nom_fdv: str = Query(...),
    session: Session = Depends(get_session),
) -> Any:
    """Return distinct clients for a given FDV/period that have sucre or huile sales."""
    rows = session.exec(
        select(Vente.nom_client)
        .distinct()
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.nom_fdv == nom_fdv)
        .where(Vente.famille.ilike('sucre') | Vente.famille.ilike('huile'))
        .order_by(Vente.nom_client)
    ).all()
    return [r for r in rows if r]


@router.get("/facturation")
def get_rapport_facturation(
    annee_mois: str = Query(...),
    nom_fdv: str = Query(...),
    clients: Optional[List[str]] = Query(default=None),
    session: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
) -> Any:
    year, month = int(annee_mois[:4]), int(annee_mois[5:7])

    rows = session.exec(
        select(Vente)
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.nom_fdv == nom_fdv)
        .where(Vente.famille.ilike('sucre') | Vente.famille.ilike('huile'))
    ).all()

    if clients:
        rows = [r for r in rows if r.nom_client in clients]

    # Build code_produit -> display name map (nom_produit if set, else description_produit)
    codes = {r.code_produit for r in rows if r.code_produit}
    produits = session.exec(select(Produit).where(Produit.code_produit.in_(codes))).all()
    code_to_label = {p.code_produit: (p.nom_produit or p.description_produit) for p in produits}
    code_to_uom = {p.code_produit: p.uom_vente for p in produits}

    def display_label(r: Vente) -> str:
        if r.code_produit and r.code_produit in code_to_label and code_to_label[r.code_produit]:
            return code_to_label[r.code_produit]
        return r.description_produit or ''

    # Distinct products (columns), sorted
    products = sorted({display_label(r) for r in rows if r.description_produit})

    # label -> uom_vente
    def uom_for_label(label: str) -> Optional[str]:
        for r in rows:
            if display_label(r) == label and r.code_produit:
                return code_to_uom.get(r.code_produit)
        return None

    products_meta = {p: uom_for_label(p) for p in products}

    # Distinct clients (rows), sorted
    client_names = sorted({r.nom_client for r in rows if r.nom_client})

    # Distinct dates that have actual orders, sorted
    dates = sorted({r.date_commande for r in rows if r.date_commande})
    date_labels = [d.strftime('%d/%m/%y') for d in dates]

    # Aggregate: client -> date_label -> product -> qty
    agg: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    for r in rows:
        if not r.nom_client or not r.description_produit or not r.date_commande:
            continue
        label = r.date_commande.strftime('%d/%m/%y')
        agg[r.nom_client][label][display_label(r)] += r.qte_facturee or 0

    clients_out = []
    for nom in client_names:
        # Only keep dates where this client has at least one product qty
        client_dates = [
            label for label in date_labels
            if any(agg[nom][label][p] for p in products)
        ]
        semaines = {}
        for label in client_dates:
            semaines[label] = {
                p: (agg[nom][label][p] if agg[nom][label][p] else None)
                for p in products
            }
        totaux = {
            p: (sum(agg[nom][label][p] for label in client_dates) or None)
            for p in products
        }
        clients_out.append({
            "nom_client": nom,
            "semaines": semaines,
            "totaux": totaux,
            "weeks": client_dates,
        })

    return {
        "fdv": nom_fdv,
        "periode": annee_mois,
        "weeks": date_labels,
        "products": products,
        "products_meta": products_meta,
        "clients": clients_out,
    }
