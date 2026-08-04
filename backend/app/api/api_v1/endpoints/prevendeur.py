from typing import Any, List, Optional
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, distinct
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.client import Client
from app.models.user import User, UserRole
from app.models.vente import Vente
from app.models.objectif import Objectif
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

    # Build meta map in one pass — O(rows) instead of O(rows × products)
    label_meta: dict = {}
    for r in rows:
        label = display_label(r)
        if label not in label_meta:
            famille = (r.famille or '').lower()
            if r.code_produit and r.code_produit in code_to_produit:
                p = code_to_produit[r.code_produit]
                label_meta[label] = {"uom_vente": p.uom_vente, "colisage": p.colisage, "famille": famille}
            else:
                label_meta[label] = {"uom_vente": None, "colisage": None, "famille": famille}
    products_meta = {p: label_meta.get(p, {"uom_vente": None, "colisage": None, "famille": None}) for p in products}

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

    fdv_codes = [pv.employe_code for pv in prevendeurs if pv.employe_code]
    if not fdv_codes:
        return []

    # 1 query: all distinct (code_fdv, code_client, nom_client) across all prevendeurs
    vente_rows = session.exec(
        select(Vente.code_fdv, Vente.code_client, Vente.nom_client)
        .distinct()
        .where(Vente.code_fdv.in_(fdv_codes), Vente.code_client.isnot(None))
    ).all()

    fdv_clients: dict = defaultdict(list)   # code_fdv -> [(code_client, nom_client)]
    all_client_codes: set = set()
    for code_fdv, code_client, nom_client in vente_rows:
        fdv_clients[code_fdv].append((code_client, nom_client))
        all_client_codes.add(code_client)

    # 1 query: last sale date per prevendeur
    last_sale_rows = session.exec(
        select(Vente.code_fdv, func.max(Vente.date_commande))
        .where(Vente.code_fdv.in_(fdv_codes))
        .group_by(Vente.code_fdv)
    ).all()
    last_sale_map = {code_fdv: last_sale for code_fdv, last_sale in last_sale_rows}

    # 1 query: all client records (for nom_sodichn)
    sodichn_map: dict = {}
    if all_client_codes:
        clients_db = session.exec(
            select(Client).where(Client.customer_no.in_(all_client_codes))
        ).all()
        sodichn_map = {c.customer_no: c.nom_sodichn for c in clients_db}

    result = []
    for pv in prevendeurs:
        if not pv.employe_code:
            continue
        clients = fdv_clients.get(pv.employe_code, [])
        total_clients = len(clients)
        matched = sum(1 for code, _ in clients if sodichn_map.get(code))
        last_sale = last_sale_map.get(pv.employe_code)
        clients_detail = [
            {
                "code_client": code,
                "nom_client": nom,
                "nom_sodichn": sodichn_map.get(code),
            }
            for code, nom in sorted(clients, key=lambda x: x[1] or '')
        ]
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
    canal: Optional[str] = Query(None),   # "VD" or "VH"
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
        select(Vente.code_fdv, func.sum(Vente.qte_livree))
        .where(Vente.annee_mois == annee_mois)
        .where(Vente.code_fdv != None)
        .group_by(Vente.code_fdv)
    )
    if canal:
        fdv_totals_q = fdv_totals_q.where(Vente.canal == canal)
    fdv_totals = {row[0]: round(row[1] or 0) for row in session.exec(fdv_totals_q).all()}

    canal_upper = canal.upper() if canal else None
    prevendeurs_out = [
        {"code": p.employe_code, "nom": p.full_name, "total": fdv_totals.get(p.employe_code, 0)}
        for p in prevendeurs_db
        if p.employe_code and (not canal_upper or canal_upper in (p.employe_code or "").upper())
    ]

    # Previous period — use the previous available period in the data (not necessarily month-1)
    try:
        cur_idx = all_periods_list.index(annee_mois)
    except ValueError:
        cur_idx = 0
    prev_periode = all_periods_list[cur_idx + 1] if cur_idx + 1 < len(all_periods_list) else None
    trend_periods = list(reversed(all_periods_list[cur_idx: cur_idx + 6]))  # chronological

    def fetch_rows(periode: str) -> list:
        q = select(
            Vente.date_commande,
            Vente.famille,
            Vente.sous_famille,
            Vente.code_produit,
            Vente.description_produit,
            Vente.qte_livree,
            Vente.code_fdv,
            Vente.nom_fdv,
            Vente.source,
        ).where(Vente.annee_mois == periode)
        if code_fdv:
            q = q.where(Vente.code_fdv == code_fdv)
        if canal:
            q = q.where(Vente.canal == canal)
        return list(session.exec(q).all())

    rows = fetch_rows(annee_mois)
    prev_rows = fetch_rows(prev_periode) if prev_periode else []

    period_totals: dict = defaultdict(float)
    if trend_periods:
        q6 = (
            select(Vente.annee_mois, func.sum(Vente.qte_livree))
            .where(Vente.annee_mois.in_(trend_periods))
        )
        if code_fdv:
            q6 = q6.where(Vente.code_fdv == code_fdv)
        if canal:
            q6 = q6.where(Vente.canal == canal)
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
    # famille -> sf -> produit -> code_fdv -> total (for per-product FDV panel)
    fdv_by_sf_prod: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(float))))
    # product label -> code_produit (first seen)
    prod_label_to_code: dict = {}

    for r in rows:
        if not r.date_commande or not r.qte_livree:
            continue
        famille = (r.famille or "").strip().lower()
        sf = (r.sous_famille or "Autres").strip()
        prod = product_label(r)
        w = week_idx(r.date_commande)
        hier[famille][sf][prod][w] += r.qte_livree
        if r.code_produit and prod not in prod_label_to_code:
            prod_label_to_code[prod] = r.code_produit
        if r.code_fdv:
            fdv_by_famille[famille][r.code_fdv] += r.qte_livree
            fdv_global[r.code_fdv] += r.qte_livree
            fdv_by_sf_prod[famille][sf][prod][r.code_fdv] += r.qte_livree
        # Supplement fdv name map from row data
        if r.code_fdv and r.nom_fdv and r.code_fdv not in fdv_name_map:
            fdv_name_map[r.code_fdv] = r.nom_fdv

    for r in prev_rows:
        if not r.qte_livree:
            continue
        famille = (r.famille or "").strip().lower()
        prev_famille_total[famille] += r.qte_livree

    # Global top FDV
    global_top_fdv = sorted(
        [{"code": c, "nom": fdv_name_map.get(c, c), "total": round(t)} for c, t in fdv_global.items()],
        key=lambda x: -x["total"]
    )[:5]

    # Objective aggregation by famille for this period
    annee_int, mois_int = int(annee_mois.split('-')[0]), int(annee_mois.split('-')[1])
    obj_rows = session.exec(
        select(
            Produit.famille,
            func.sum(Objectif.objectif_packs_vd).label('packs_vd'),
            func.sum(Objectif.objectif_packs_vh).label('packs_vh'),
        )
        .join(Produit, Objectif.code_produit == Produit.code_produit)
        .where(Objectif.mois == mois_int, Objectif.annee == annee_int)
        .group_by(Produit.famille)
    ).all()

    if canal == 'VD':
        obj_by_famille = {(r.famille or '').strip().lower(): round(r.packs_vd or 0) for r in obj_rows}
    elif canal == 'VH':
        obj_by_famille = {(r.famille or '').strip().lower(): round(r.packs_vh or 0) for r in obj_rows}
    else:
        obj_by_famille = {(r.famille or '').strip().lower(): round((r.packs_vd or 0) + (r.packs_vh or 0)) for r in obj_rows}
    objectif_total = sum(obj_by_famille.values())

    # Per-route objective: sum of per-tournée targets across all products
    obj_pr = session.exec(
        select(
            func.sum(Objectif.objectif_packs_vd_tournee).label('pr_vd'),
            func.sum(Objectif.objectif_packs_vh_tournee).label('pr_vh'),
        )
        .where(Objectif.mois == mois_int, Objectif.annee == annee_int)
    ).first()
    if canal == 'VD':
        objectif_per_route = round(obj_pr.pr_vd or 0) if obj_pr else 0
    elif canal == 'VH':
        objectif_per_route = round(obj_pr.pr_vh or 0) if obj_pr else 0
    else:
        objectif_per_route = round((obj_pr.pr_vd or 0) + (obj_pr.pr_vh or 0)) if obj_pr else 0

    # Per-product objectives (total + per-tournée)
    obj_prod_rows = session.exec(
        select(
            Objectif.code_produit,
            Objectif.objectif_packs_vd, Objectif.objectif_packs_vh,
            Objectif.objectif_packs_vd_tournee, Objectif.objectif_packs_vh_tournee,
        )
        .where(Objectif.mois == mois_int, Objectif.annee == annee_int)
    ).all()
    if canal == 'VD':
        obj_by_prod        = {r.code_produit: r.objectif_packs_vd_tournee for r in obj_prod_rows}
        obj_by_prod_total  = {r.code_produit: r.objectif_packs_vd for r in obj_prod_rows}
    elif canal == 'VH':
        obj_by_prod        = {r.code_produit: r.objectif_packs_vh_tournee for r in obj_prod_rows}
        obj_by_prod_total  = {r.code_produit: r.objectif_packs_vh for r in obj_prod_rows}
    else:
        obj_by_prod        = {r.code_produit: (r.objectif_packs_vd_tournee or 0) + (r.objectif_packs_vh_tournee or 0) for r in obj_prod_rows}
        obj_by_prod_total  = {r.code_produit: (r.objectif_packs_vd or 0) + (r.objectif_packs_vh or 0) for r in obj_prod_rows}

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
                prod_top_fdv = sorted(
                    [{"code": c, "nom": fdv_name_map.get(c, c), "total": round(t)}
                     for c, t in fdv_by_sf_prod[famille][sf][prod].items()],
                    key=lambda x: -x["total"]
                )
                prod_code = prod_label_to_code.get(prod)
                prod_obj_t = obj_by_prod.get(prod_code) if prod_code else None
                prod_obj   = obj_by_prod_total.get(prod_code) if prod_code else None
                prods_out.append({
                    "nom": prod,
                    "total": round(sum(wks)),
                    "weeks": [round(v) for v in wks],
                    "top_fdv": prod_top_fdv,
                    "objectif_packs": round(prod_obj) if prod_obj else None,
                    "objectif_packs_tournee": round(prod_obj_t) if prod_obj_t else None,
                })
            for i in range(4):
                f_weeks[i] += sf_weeks[i]
            sf_obj_vals = [
                obj_by_prod_total[prod_label_to_code[p["nom"]]]
                for p in prods_out
                if p["nom"] in prod_label_to_code and prod_label_to_code[p["nom"]] in obj_by_prod_total
                and obj_by_prod_total[prod_label_to_code[p["nom"]]]
            ]
            sf_obj = round(sum(sf_obj_vals)) if sf_obj_vals else None
            sfs_out.append({
                "nom": sf,
                "total": round(sum(sf_weeks)),
                "weeks": [round(v) for v in sf_weeks],
                "produits": sorted(prods_out, key=lambda x: -x["total"]),
                "objectif_packs": sf_obj,
            })

        f_total = round(sum(f_weeks))
        prev_total = round(prev_famille_total.get(famille, 0))
        delta_pct = round((f_total - prev_total) / prev_total * 100) if prev_total > 0 else None

        top_fdv = sorted(
            [{"code": c, "nom": fdv_name_map.get(c, c), "total": round(t)} for c, t in fdv_by_famille[famille].items()],
            key=lambda x: -x["total"]
        )

        familles_out.append({
            "nom": famille,
            "total": f_total,
            "total_prev": prev_total,
            "delta_pct": delta_pct,
            "weeks": [round(v) for v in f_weeks],
            "sous_familles": sorted(sfs_out, key=lambda x: -x["total"]),
            "top_fdv": top_fdv,
            "objectif_packs": obj_by_famille.get(famille) or None,
        })

    return {
        "periode": annee_mois,
        "periodes": list(all_periods),
        "prevendeurs": prevendeurs_out,
        "trend_6m": trend_6m,
        "trend_6m_labels": trend_6m_labels,
        "top_fdv": global_top_fdv,
        "familles": sorted(familles_out, key=lambda x: -x["total"]),
        "objectif_packs_total": objectif_total or None,
        "objectif_packs_per_route": objectif_per_route or None,
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
