import json
import logging
from typing import Any, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Query, UploadFile

logger = logging.getLogger("app.upload")
from fastapi.responses import StreamingResponse
from sqlalchemy import func, delete as sa_delete
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.user import User
from app.models.vente import Vente, VentePage, VenteRead
from app.utils.parse import parse_file

router = APIRouter()


def _safe_str(val: Any, max_len: int) -> Optional[str]:
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return s[:max_len] if s else None


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return None if pd.isna(f) else f
    except (ValueError, TypeError):
        return None


def _safe_date(val: Any) -> Optional[Any]:
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    try:
        ts = pd.to_datetime(val, dayfirst=True)
        if pd.isna(ts):
            return None
        return ts.date()
    except Exception:
        return None


def _row_to_vente(row: pd.Series, annee_mois: str, uploaded_by_id: int) -> Vente:
    date_val = row.get('Date')
    date_obj = date_val.date() if pd.notna(date_val) and hasattr(date_val, 'date') else None

    return Vente(
        annee_mois=annee_mois,
        date_commande=date_obj,
        num_commande=_safe_str(row.get('N° Commande'), 60),
        type_commande=_safe_str(row.get('Type'), 30),
        source=_safe_str(row.get('Source'), 30),
        code_client=_safe_str(row.get('Code Client'), 50),
        nom_client=_safe_str(row.get('Nom client'), 150),
        categorie_client=_safe_str(row.get('Categories Client'), 20),
        adresse_client=_safe_str(row.get('Adresse Client'), 200),
        route=_safe_str(row.get('Route'), 50),
        commune=_safe_str(row.get('Commune'), 60),
        wilaya=_safe_str(row.get('Wilya'), 60),           # source typo
        zone=_safe_str(row.get('Zone'), 30),
        region=_safe_str(row.get('Region'), 30),
        tel_client=_safe_str(row.get('Tél'), 30),
        type_client=_safe_str(row.get('Type Client'), 20),
        code_fdv=_safe_str(row.get('Code-FDV'), 30),
        nom_fdv=_safe_str(row.get('Nom-FDV'), 100),
        type_fdv=_safe_str(row.get('Type-FDV'), 30),
        code_sup=_safe_str(row.get('Code-Sup'), 30),
        nom_sup=_safe_str(row.get('Nom-Sup'), 100),
        buid=_safe_str(row.get('BUID'), 30),
        code_distributeur=_safe_str(row.get('Code Distributeur'), 30),
        nom_distributeur=_safe_str(row.get('Nom Distributeur'), 100),
        depot_livraison=_safe_str(row.get('Dépôt Livraison'), 50),
        statut_commande=_safe_str(row.get('Statut Commande'), 30),
        date_creation=_safe_date(row.get('Date Création')),
        date_confirmation=_safe_date(row.get('Date Confirmation')),
        date_facturation=_safe_date(row.get('Date Facturation')),
        code_livreur=_safe_str(row.get('Code Livreur'), 30),
        nom_livreur=_safe_str(row.get('Nom Livreur'), 100),
        matricule_van=_safe_str(row.get('Matricule VAN'), 30),
        code_produit=_safe_str(row.get('Code Produit'), 30),
        description_produit=_safe_str(row.get('Description Produit'), 200),
        famille=_safe_str(row.get('Famille'), 50),
        sous_famille=_safe_str(row.get('Sous Famille'), 80),
        uom_vente=_safe_str(row.get('UOM Vente'), 20),
        cout_produit=_safe_float(row.get('Cout Produit')),
        prix_unitaire=_safe_float(row.get('Prix Unitaire')),
        uom_principale=_safe_str(row.get('UOM principale'), 20),
        prix_unitaire_uom_pr=_safe_float(row.get('Prix unitaire UOM PR')),
        qte_commandee=_safe_float(row.get('Qte Commandée')),
        qte_chargee=_safe_float(row.get('Qte Chargée')),
        qte_livree=_safe_float(row.get('Qte Livrée')),
        qte_facturee=_safe_float(row.get('Qte  Facturée')),    # double space
        total_commande=_safe_float(row.get('Total Commandée')),
        total_facture=_safe_float(row.get('Total  Facturée')), # double space
        total_remise=_safe_float(row.get('Total Remise')),
        gratuite=_safe_float(row.get('Gratuité')),
        uploaded_by_id=uploaded_by_id,
    )


@router.get("", response_model=VentePage)
def list_ventes(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    annee_mois: Optional[str] = Query(default=None),
    famille: Optional[str] = Query(default=None),
    nom_fdv: Optional[str] = Query(default=None),
    nom_client: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> Any:
    conditions = []
    if annee_mois:
        conditions.append(Vente.annee_mois == annee_mois)
    if famille:
        conditions.append(Vente.famille == famille)
    if nom_fdv:
        conditions.append(Vente.nom_fdv == nom_fdv)
    if nom_client:
        conditions.append(Vente.nom_client == nom_client)
    if search:
        term = f"%{search}%"
        conditions.append(
            Vente.nom_client.ilike(term) |
            Vente.description_produit.ilike(term) |
            Vente.num_commande.ilike(term)
        )

    count_q = select(func.count(Vente.id))
    items_q = select(Vente)
    for c in conditions:
        count_q = count_q.where(c)
        items_q = items_q.where(c)

    total = session.exec(count_q).one()
    offset = (page - 1) * per_page
    items = session.exec(
        items_q.order_by(Vente.date_commande.desc()).offset(offset).limit(per_page)
    ).all()

    return VentePage(
        total=total,
        items=[VenteRead.model_validate(v) for v in items],
    )


@router.get("/periodes", response_model=List[str])
def list_periodes(session: Session = Depends(get_session)) -> Any:
    result = session.exec(
        select(Vente.annee_mois).distinct().order_by(Vente.annee_mois.desc())
    ).all()
    return list(result)


@router.get("/fdvs", response_model=List[str])
def list_fdvs(
    annee_mois: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> Any:
    q = select(Vente.nom_fdv).distinct().order_by(Vente.nom_fdv)
    if annee_mois:
        q = q.where(Vente.annee_mois == annee_mois)
    return [v for v in session.exec(q).all() if v]


@router.get("/familles", response_model=List[str])
def list_familles(
    annee_mois: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> Any:
    q = select(Vente.famille).distinct().order_by(Vente.famille)
    if annee_mois:
        q = q.where(Vente.annee_mois == annee_mois)
    return [v for v in session.exec(q).all() if v]


@router.get("/clients", response_model=List[str])
def list_clients(
    annee_mois: Optional[str] = Query(default=None),
    nom_fdv: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> Any:
    q = select(Vente.nom_client).distinct().order_by(Vente.nom_client)
    if annee_mois:
        q = q.where(Vente.annee_mois == annee_mois)
    if nom_fdv:
        q = q.where(Vente.nom_fdv == nom_fdv)
    return [v for v in session.exec(q).all() if v]


@router.post("/upload")
async def upload_ventes(
    file: UploadFile = File(...),
    mode: Optional[str] = Query(default=None),  # 'skip' | 'replace'
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    content = await file.read()
    filename = file.filename or ''

    def event(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    def generate():
        logger.info(f"Upload démarré : {filename} par {current_user.full_name} ({len(content) // 1024} KB)")
        yield event({"progress": 5, "message": "Lecture du fichier..."})

        try:
            df = parse_file(content, filename)
        except Exception as e:
            logger.error(f"Upload échoué (lecture fichier) : {filename} — {e}")
            yield event({"error": f"Impossible de lire le fichier : {e}"})
            return

        df = df.dropna(subset=['Date'])
        if df.empty:
            yield event({"error": "Aucune ligne valide trouvée dans le fichier"})
            return

        total_rows = len(df)
        date_min = df['Date'].min().strftime('%d/%m/%Y')
        date_max = df['Date'].max().strftime('%d/%m/%Y')
        yield event({
            "progress": 15,
            "message": f"{total_rows:,} lignes trouvées...",
            "file_info": {"total_rows": total_rows, "date_min": date_min, "date_max": date_max},
        })

        # Date overlap check
        file_dates = list({d for d in df['Date'].dt.date if d is not None})
        existing_dates = set(session.exec(
            select(Vente.date_commande)
            .where(Vente.date_commande.in_(file_dates))
            .distinct()
        ).all())
        existing_dates.discard(None)

        if existing_dates and mode is None:
            overlap_sorted = sorted(existing_dates)
            yield event({
                "type": "overlap",
                "overlap_min": overlap_sorted[0].strftime('%d/%m/%Y'),
                "overlap_max": overlap_sorted[-1].strftime('%d/%m/%Y'),
                "overlap_count": len(overlap_sorted),
            })
            return

        if mode == 'replace' and existing_dates:
            yield event({"progress": 20, "message": "Suppression des données existantes..."})
            session.exec(sa_delete(Vente).where(Vente.date_commande.in_(list(existing_dates))))
            session.commit()
        elif mode == 'skip' and existing_dates:
            df = df[~df['Date'].dt.date.isin(existing_dates)]
            if df.empty:
                yield event({"error": "Toutes les dates sont déjà présentes dans la base"})
                return

        yield event({"progress": 25, "message": "Préparation des enregistrements..."})

        ventes = []
        for _, row in df.iterrows():
            date_val = row.get('Date')
            if pd.isna(date_val):
                continue
            row_month = date_val.strftime('%Y-%m')
            ventes.append(_row_to_vente(row, row_month, current_user.id))

        total = len(ventes)
        if total == 0:
            yield event({"error": "Aucune ligne valide à insérer"})
            return

        BATCH = 1000
        for i in range(0, total, BATCH):
            batch = ventes[i:i + BATCH]
            session.add_all(batch)
            session.flush()
            inserted = min(i + len(batch), total)
            progress = 30 + int(65 * inserted / total)
            yield event({
                "progress": progress,
                "message": f"{inserted:,} / {total:,} lignes insérées...",
            })

        session.commit()

        dominant_month = df['Date'].dt.strftime('%Y-%m').value_counts().idxmax()
        logger.info(f"Upload terminé : {total:,} lignes importées ({dominant_month}) par {current_user.full_name}")
        yield event({
            "progress": 100,
            "done": True,
            "message": f"{total:,} lignes importées avec succès",
        })

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
