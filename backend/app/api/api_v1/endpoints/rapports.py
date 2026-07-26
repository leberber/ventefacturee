from typing import Any, List, Optional
from collections import defaultdict
from datetime import date, timedelta
import calendar

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.vente import Vente

router = APIRouter()

FAMILLES_RAPPORT = ['sucre', 'huile']


def _month_weeks(year: int, month: int) -> list:
    """Return ISO week numbers that contain at least one day of the month, in order."""
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    seen, current = [], first
    while current <= last:
        w = current.isocalendar()[1]
        if w not in seen:
            seen.append(w)
        current += timedelta(days=1)
    return seen  # e.g. [27, 28, 29, 30]


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
    week_nums = _month_weeks(year, month)
    week_labels = {w: f"Semaine {i + 1}" for i, w in enumerate(week_nums)}

    rows = session.exec(
        select(Vente)
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.nom_fdv == nom_fdv)
        .where(Vente.famille.ilike('sucre') | Vente.famille.ilike('huile'))
    ).all()

    if clients:
        rows = [r for r in rows if r.nom_client in clients]

    # Distinct products (columns), sorted
    products = sorted({r.description_produit for r in rows if r.description_produit})

    # Distinct clients (rows), sorted
    client_names = sorted({r.nom_client for r in rows if r.nom_client})

    # Aggregate: client -> iso_week -> product -> qty
    agg: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    for r in rows:
        if not r.nom_client or not r.description_produit or not r.date_commande:
            continue
        _, wk, _ = r.date_commande.isocalendar()
        agg[r.nom_client][wk][r.description_produit] += r.qte_facturee or 0

    clients_out = []
    for nom in client_names:
        semaines = {}
        for wk in week_nums:
            label = week_labels[wk]
            semaines[label] = {
                p: (agg[nom][wk][p] if agg[nom][wk][p] else None)
                for p in products
            }
        totaux = {
            p: (sum(agg[nom][wk][p] for wk in week_nums) or None)
            for p in products
        }
        clients_out.append({
            "nom_client": nom,
            "semaines": semaines,
            "totaux": totaux,
        })

    return {
        "fdv": nom_fdv,
        "periode": annee_mois,
        "weeks": [week_labels[w] for w in week_nums],
        "products": products,
        "clients": clients_out,
    }
