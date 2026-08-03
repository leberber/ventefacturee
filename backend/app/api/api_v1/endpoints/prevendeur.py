from typing import Any, List, Optional
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import or_, func
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.client import Client
from app.models.user import User, UserRole
from app.models.vente import Vente
from app.models.produit import Produit

router = APIRouter()


@router.get("/periodes", response_model=List[str])
def prevendeur_periodes(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    if not current_user.employe_code:
        return []
    rows = session.exec(
        select(Vente.annee_mois)
        .distinct()
        .where(Vente.code_fdv == current_user.employe_code)
        .order_by(Vente.annee_mois.desc())
    ).all()
    return list(rows)


@router.get("/facturation")
def prevendeur_facturation(
    annee_mois: str = Query(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    if not current_user.employe_code:
        return {"fdv_nom": "", "periode": annee_mois, "routes": [], "products": [], "products_meta": {}, "total_clients": 0}

    rows = session.exec(
        select(Vente)
        .where(Vente.code_fdv == current_user.employe_code)
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.famille.ilike('sucre') | Vente.famille.ilike('huile'))
    ).all()

    # Exclude explicit BackOffice rows
    rows = [r for r in rows if r.source != 'BackOffice']

    if not rows:
        return {"fdv_nom": current_user.full_name, "periode": annee_mois, "routes": [], "products": [], "products_meta": {}, "total_clients": 0}

    # Product metadata
    codes = {r.code_produit for r in rows if r.code_produit}
    produits_db = session.exec(select(Produit).where(Produit.code_produit.in_(codes))).all()
    code_to_produit = {p.code_produit: p for p in produits_db}
    code_to_label = {p.code_produit: (p.nom_produit or p.description_produit) for p in produits_db}

    # Exclude non-facturable
    rows = [
        r for r in rows
        if not (r.code_produit and r.code_produit in code_to_produit and not code_to_produit[r.code_produit].facturable)
    ]

    def display_label(r: Vente) -> str:
        if r.code_produit and r.code_produit in code_to_label and code_to_label[r.code_produit]:
            return code_to_label[r.code_produit]
        return r.description_produit or ''

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

    # Aggregate: client -> date_label -> product -> qty
    agg: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    client_meta: dict = {}

    for r in rows:
        if not r.nom_client or not r.description_produit or not r.date_commande:
            continue
        label = r.date_commande.strftime('%d/%m/%y')
        agg[r.nom_client][label][display_label(r)] += r.qte_facturee or 0
        if r.nom_client not in client_meta:
            client_meta[r.nom_client] = {
                'code_client': r.code_client,
                'route': r.route or 'Sans route',
            }

    all_dates = sorted({r.date_commande for r in rows if r.date_commande})
    date_labels = [d.strftime('%d/%m/%y') for d in all_dates]

    # Group clients by route
    route_clients: dict = defaultdict(list)
    for nom, meta in sorted(client_meta.items()):
        route_clients[meta['route']].append(nom)

    fdv_nom = rows[0].nom_fdv if rows else current_user.full_name

    # Fetch nom_sodichn from clients table for all client codes
    client_codes = [m['code_client'] for m in client_meta.values() if m.get('code_client')]
    clients_db = session.exec(select(Client).where(Client.customer_no.in_(client_codes))).all() if client_codes else []
    nom_sodichn_map = {c.customer_no: c.nom_sodichn for c in clients_db}

    routes_out = []
    for route in sorted(route_clients.keys()):
        clients_out = []
        for nom in route_clients[route]:
            client_dates = [l for l in date_labels if any(agg[nom][l][p] for p in products)]
            if not client_dates:
                continue
            semaines = {
                l: {p: (agg[nom][l][p] if agg[nom][l][p] else None) for p in products}
                for l in client_dates
            }
            totaux = {p: (sum(agg[nom][l][p] for l in client_dates) or None) for p in products}
            code = client_meta[nom]['code_client']
            clients_out.append({
                "nom_client": nom,
                "code_client": code,
                "nom_sodichn": nom_sodichn_map.get(code),
                "derniere_visite": client_dates[-1],
                "weeks": client_dates,
                "semaines": semaines,
                "totaux": totaux,
            })
        if clients_out:
            routes_out.append({"route": route, "clients": clients_out})

    return {
        "fdv_nom": fdv_nom,
        "periode": annee_mois,
        "products": products,
        "products_meta": products_meta,
        "total_clients": sum(len(r["clients"]) for r in routes_out),
        "routes": routes_out,
    }


@router.get("/admin/stats")
def prevendeur_admin_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    prevendeurs = session.exec(
        select(User)
        .where(User.role == UserRole.PREVENDER)
        .where(User.is_active == True)
        .order_by(User.full_name)
    ).all()

    result = []
    for pv in prevendeurs:
        if not pv.employe_code:
            continue

        client_codes = session.exec(
            select(Vente.code_client).distinct()
            .where(Vente.code_fdv == pv.employe_code)
            .where(Vente.code_client != None)
        ).all()
        total_clients = len(client_codes)

        matched = 0
        if client_codes:
            matched = session.exec(
                select(func.count(Client.id))
                .where(Client.customer_no.in_(client_codes))
                .where(Client.nom_sodichn != None)
                .where(Client.nom_sodichn != '')
            ).one()

        last_sale = session.exec(
            select(func.max(Vente.date_commande))
            .where(Vente.code_fdv == pv.employe_code)
        ).one()

        # Build client list with nom_sodichn for drilldown
        clients_detail = []
        if client_codes:
            clients_db = session.exec(
                select(Client).where(Client.customer_no.in_(client_codes)).order_by(Client.name)
            ).all()
            sodichn_map = {c.customer_no: c.nom_sodichn for c in clients_db}
            # Get nom_client from ventes for display
            vente_names = session.exec(
                select(Vente.code_client, Vente.nom_client).distinct()
                .where(Vente.code_fdv == pv.employe_code)
                .where(Vente.code_client != None)
            ).all()
            for code, nom in sorted(vente_names, key=lambda x: x[1] or ''):
                clients_detail.append({
                    "code_client": code,
                    "nom_client": nom,
                    "nom_sodichn": sodichn_map.get(code),
                })

        result.append({
            "id": pv.id,
            "full_name": pv.full_name,
            "employe_code": pv.employe_code,
            "total_clients": total_clients,
            "clients_with_sodichn": matched,
            "completion_pct": round(matched / total_clients * 100) if total_clients > 0 else 0,
            "last_activity": last_sale.strftime('%Y-%m-%d') if last_sale else None,
            "clients": clients_detail,
        })

    return result


@router.get("/admin/drilldown")
def prevendeur_admin_drilldown(
    annee_mois: str = Query(...),
    code_fdv: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    from collections import defaultdict

    all_periods = session.exec(
        select(Vente.annee_mois).distinct().order_by(Vente.annee_mois.desc())
    ).all()
    all_periods_list = list(all_periods)

    # Prevendeurs list with their totals for the current period (always unfiltered)
    prevendeurs_db = session.exec(
        select(User)
        .where(User.role == UserRole.PREVENDER)
        .where(User.is_active == True)
        .order_by(User.full_name)
    ).all()
    fdv_name_map = {p.employe_code: p.full_name for p in prevendeurs_db if p.employe_code}

    fdv_totals_q = (
        select(Vente.code_fdv, func.sum(Vente.qte_facturee))
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.code_fdv != None)
        .where(or_(Vente.source != "BackOffice", Vente.source == None))
        .group_by(Vente.code_fdv)
    )
    fdv_totals = {row[0]: round(row[1] or 0) for row in session.exec(fdv_totals_q).all()}

    prevendeurs_out = [
        {"code": p.employe_code, "nom": p.full_name, "total": fdv_totals.get(p.employe_code, 0)}
        for p in prevendeurs_db if p.employe_code
    ]

    # Previous period
    try:
        year, month = int(annee_mois[:4]), int(annee_mois[5:])
        prev_month = month - 1 if month > 1 else 12
        prev_year = year if month > 1 else year - 1
        prev_periode = f"{prev_year}-{prev_month:02d}"
    except Exception:
        prev_periode = None

    def fetch_rows(periode: str) -> list:
        q = select(Vente).where(Vente.annee_mois == periode)
        if code_fdv:
            q = q.where(Vente.code_fdv == code_fdv)
        rs = session.exec(q).all()
        return [r for r in rs if r.source != "BackOffice"]

    rows = fetch_rows(annee_mois)
    prev_rows = fetch_rows(prev_periode) if prev_periode else []

    # 6-month trend via SQL aggregation (always unfiltered by code_fdv for global view)
    try:
        cur_idx = all_periods_list.index(annee_mois)
    except ValueError:
        cur_idx = 0
    trend_periods = list(reversed(all_periods_list[cur_idx: cur_idx + 6]))  # chronological

    period_totals: dict = defaultdict(float)
    if trend_periods:
        q6 = (
            select(Vente.annee_mois, func.sum(Vente.qte_facturee))
            .where(Vente.annee_mois.in_(trend_periods))
            .where(or_(Vente.source != "BackOffice", Vente.source == None))
        )
        if code_fdv:
            q6 = q6.where(Vente.code_fdv == code_fdv)
        q6 = q6.group_by(Vente.annee_mois)
        for periode, total in session.exec(q6).all():
            period_totals[periode] = total or 0

    trend_6m = [round(period_totals.get(p, 0)) for p in trend_periods]
    trend_6m_labels = trend_periods

    # Product label resolution
    codes = {r.code_produit for r in rows if r.code_produit}
    produits_db = session.exec(select(Produit).where(Produit.code_produit.in_(codes))).all() if codes else []
    code_to_produit = {p.code_produit: p for p in produits_db}

    def week_idx(d) -> int:
        if d is None:
            return 0
        day = d.day
        if day <= 7: return 0
        if day <= 14: return 1
        if day <= 21: return 2
        return 3

    def product_label(r: Vente) -> str:
        if r.code_produit and r.code_produit in code_to_produit:
            p = code_to_produit[r.code_produit]
            return p.nom_produit or r.description_produit or "Autre"
        return r.description_produit or "Autre"

    # famille -> sous_famille -> produit -> [w0,w1,w2,w3]
    hier: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0.0] * 4)))
    # famille -> code_fdv -> total
    fdv_by_famille: dict = defaultdict(lambda: defaultdict(float))
    fdv_global: dict = defaultdict(float)
    prev_famille_total: dict = defaultdict(float)

    for r in rows:
        if not r.date_commande or not r.qte_facturee:
            continue
        famille = (r.famille or "").strip().lower()
        sf = (r.sous_famille or "Autres").strip()
        prod = product_label(r)
        w = week_idx(r.date_commande)
        hier[famille][sf][prod][w] += r.qte_facturee
        if r.code_fdv:
            fdv_by_famille[famille][r.code_fdv] += r.qte_facturee
            fdv_global[r.code_fdv] += r.qte_facturee
        # Supplement fdv name map from row data
        if r.code_fdv and r.nom_fdv and r.code_fdv not in fdv_name_map:
            fdv_name_map[r.code_fdv] = r.nom_fdv

    for r in prev_rows:
        if not r.qte_facturee:
            continue
        famille = (r.famille or "").strip().lower()
        prev_famille_total[famille] += r.qte_facturee

    # Global top FDV
    global_top_fdv = sorted(
        [{"code": c, "nom": fdv_name_map.get(c, c), "total": round(t)} for c, t in fdv_global.items()],
        key=lambda x: -x["total"]
    )[:5]

    familles_out = []
    for famille, sf_map in sorted(hier.items()):
        f_weeks = [0.0] * 4
        sfs_out = []
        for sf, prod_map in sf_map.items():
            sf_weeks = [0.0] * 4
            prods_out = []
            for prod, wks in prod_map.items():
                for i in range(4):
                    sf_weeks[i] += wks[i]
                prods_out.append({"nom": prod, "total": round(sum(wks)), "weeks": [round(v) for v in wks]})
            for i in range(4):
                f_weeks[i] += sf_weeks[i]
            sfs_out.append({
                "nom": sf,
                "total": round(sum(sf_weeks)),
                "weeks": [round(v) for v in sf_weeks],
                "produits": sorted(prods_out, key=lambda x: -x["total"]),
            })

        f_total = round(sum(f_weeks))
        prev_total = round(prev_famille_total.get(famille, 0))
        delta_pct = round((f_total - prev_total) / prev_total * 100) if prev_total > 0 else None

        top_fdv = sorted(
            [{"code": c, "nom": fdv_name_map.get(c, c), "total": round(t)} for c, t in fdv_by_famille[famille].items()],
            key=lambda x: -x["total"]
        )[:5]

        familles_out.append({
            "nom": famille,
            "total": f_total,
            "total_prev": prev_total,
            "delta_pct": delta_pct,
            "weeks": [round(v) for v in f_weeks],
            "sous_familles": sorted(sfs_out, key=lambda x: -x["total"]),
            "top_fdv": top_fdv,
        })

    return {
        "periode": annee_mois,
        "periodes": list(all_periods),
        "prevendeurs": prevendeurs_out,
        "trend_6m": trend_6m,
        "trend_6m_labels": trend_6m_labels,
        "top_fdv": global_top_fdv,
        "familles": sorted(familles_out, key=lambda x: -x["total"]),
    }


@router.patch("/clients/{code_client}")
def update_nom_sodichn(
    code_client: str,
    nom_sodichn: str = Body(..., embed=True),
    nom_client: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Any:
    client = session.exec(select(Client).where(Client.customer_no == code_client)).first()
    if client:
        client.nom_sodichn = nom_sodichn or None
        client.updated_at = datetime.now(timezone.utc)
    else:
        client = Client(customer_no=code_client, name=nom_client, nom_sodichn=nom_sodichn or None)
        session.add(client)
    session.commit()
    return {"ok": True}
