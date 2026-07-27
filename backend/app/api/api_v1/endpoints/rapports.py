from typing import Any, List, Optional
from collections import defaultdict
from datetime import date, timedelta
import calendar
import io
import re
import zipfile

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
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
    source: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> Any:
    """Return distinct clients for a given FDV/period that have sucre or huile sales."""
    q = (
        select(Vente.nom_client)
        .distinct()
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.nom_fdv == nom_fdv)
        .where(Vente.famille.ilike('sucre') | Vente.famille.ilike('huile'))
        .order_by(Vente.nom_client)
    )
    if source and source != 'both':
        q = q.where(or_(Vente.source != 'BackOffice', Vente.source.is_(None)))
    return [r for r in session.exec(q).all() if r]


@router.get("/facturation")
def get_rapport_facturation(
    annee_mois: str = Query(...),
    nom_fdv: str = Query(...),
    clients: Optional[List[str]] = Query(default=None),
    source: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
) -> Any:
    year, month = int(annee_mois[:4]), int(annee_mois[5:7])

    q = (
        select(Vente)
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.nom_fdv == nom_fdv)
        .where(Vente.famille.ilike('sucre') | Vente.famille.ilike('huile'))
    )
    if source and source != 'both':
        q = q.where(or_(Vente.source != 'BackOffice', Vente.source.is_(None)))
    rows = session.exec(q).all()

    if clients:
        rows = [r for r in rows if r.nom_client in clients]

    # Build code_produit -> display name map (nom_produit if set, else description_produit)
    codes = {r.code_produit for r in rows if r.code_produit}
    produits = session.exec(select(Produit).where(Produit.code_produit.in_(codes))).all()
    code_to_label = {p.code_produit: (p.nom_produit or p.description_produit) for p in produits}
    code_to_produit = {p.code_produit: p for p in produits}

    # Exclude products explicitly marked non-facturable
    rows = [
        r for r in rows
        if not (r.code_produit and r.code_produit in code_to_produit and not code_to_produit[r.code_produit].facturable)
    ]

    def display_label(r: Vente) -> str:
        if r.code_produit and r.code_produit in code_to_label and code_to_label[r.code_produit]:
            return code_to_label[r.code_produit]
        return r.description_produit or ''

    # Distinct products (columns), sorted
    products = sorted({display_label(r) for r in rows if r.description_produit})

    def meta_for_label(label: str) -> dict:
        for r in rows:
            if display_label(r) == label:
                famille = (r.famille or '').lower()
                if r.code_produit and r.code_produit in code_to_produit:
                    p = code_to_produit[r.code_produit]
                    return {"uom_vente": p.uom_vente, "colisage": p.colisage, "famille": famille}
                return {"uom_vente": None, "colisage": None, "famille": famille}
        return {"uom_vente": None, "colisage": None, "famille": None}

    products_meta = {p: meta_for_label(p) for p in products}

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


@router.get("/export-clients-zip")
def export_clients_zip(
    annee_mois: str = Query(...),
    nom_fdv: str = Query(...),
    clients: Optional[List[str]] = Query(default=None),
    display_mode: str = Query(default="brut"),
    source: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
) -> StreamingResponse:
    """One .xlsx per client (all products pre-filled), bundled as ZIP."""
    import openpyxl
    from openpyxl.styles import Font

    q = (
        select(Vente)
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.nom_fdv == nom_fdv)
        .where(Vente.famille.ilike('sucre') | Vente.famille.ilike('huile'))
    )
    if source and source != 'both':
        q = q.where(or_(Vente.source != 'BackOffice', Vente.source.is_(None)))
    rows = session.exec(q).all()

    if clients:
        rows = [r for r in rows if r.nom_client in clients]

    # Build code_produit → Produit map
    codes = {r.code_produit for r in rows if r.code_produit}
    produits_db = session.exec(select(Produit).where(Produit.code_produit.in_(codes))).all()
    code_to_produit = {p.code_produit: p for p in produits_db}

    # Exclude products explicitly marked non-facturable
    rows = [
        r for r in rows
        if not (r.code_produit and r.code_produit in code_to_produit and not code_to_produit[r.code_produit].facturable)
    ]

    use_unites = display_mode == "unites"

    # All distinct product keys for the period, sorted
    all_product_keys = sorted({
        r.code_produit or r.description_produit or ""
        for r in rows if r.code_produit or r.description_produit
    })

    def get_prix(key: str) -> Optional[float]:
        p = code_to_produit.get(key)
        return p.prix if p else None

    def get_colisage(key: str) -> Optional[float]:
        p = code_to_produit.get(key)
        return p.colisage if p else None

    # Aggregate: client → product_key → qty
    client_qty: dict = defaultdict(lambda: defaultdict(float))
    all_client_names: set = set()
    for r in rows:
        if not r.nom_client:
            continue
        all_client_names.add(r.nom_client)
        key = r.code_produit or r.description_produit or ""
        client_qty[r.nom_client][key] += r.qte_facturee or 0

    def safe_name(s: str) -> str:
        return re.sub(r'[\\/*?:"<>|]', "_", s)[:80]

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for client_name in sorted(all_client_names):
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Détail"

            # Header row
            ws.append(["Code", "Quantity", "UnitPrice"])
            for cell in ws[1]:
                cell.font = Font(bold=True, size=10)

            # One row per product; qty=0 if client didn't purchase it
            for key in all_product_keys:
                qty = client_qty[client_name].get(key, 0.0)
                col = get_colisage(key)
                if use_unites and col:
                    qty = qty * col
                qty = round(qty, 2)
                prix = get_prix(key)
                ws.append([key, qty, prix])

            xl_buf = io.BytesIO()
            wb.save(xl_buf)
            xl_buf.seek(0)
            zf.writestr(f"{safe_name(client_name)}.xlsx", xl_buf.read())

    zip_buf.seek(0)
    zip_name = f"export_{safe_name(nom_fdv)}_{annee_mois}.zip"
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )
