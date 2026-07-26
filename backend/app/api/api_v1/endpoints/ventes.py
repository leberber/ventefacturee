from typing import Any, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.user import User
from app.models.vente import Vente, UploadResponse
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
        code_client=_safe_str(row.get('Code Client'), 50),
        nom_client=_safe_str(row.get('Nom client'), 150),
        categorie_client=_safe_str(row.get('Categories Client'), 20),
        route=_safe_str(row.get('Route'), 50),
        commune=_safe_str(row.get('Commune'), 60),
        wilaya=_safe_str(row.get('Wilya'), 60),          # source has typo "Wilya"
        zone=_safe_str(row.get('Zone'), 30),
        region=_safe_str(row.get('Region'), 30),
        type_client=_safe_str(row.get('Type Client'), 20),
        code_fdv=_safe_str(row.get('Code-FDV'), 30),
        nom_fdv=_safe_str(row.get('Nom-FDV'), 100),
        type_fdv=_safe_str(row.get('Type-FDV'), 30),
        code_sup=_safe_str(row.get('Code-Sup'), 30),
        nom_sup=_safe_str(row.get('Nom-Sup'), 100),
        code_distributeur=_safe_str(row.get('Code Distributeur'), 30),
        nom_distributeur=_safe_str(row.get('Nom Distributeur'), 100),
        depot_livraison=_safe_str(row.get('Dépôt Livraison'), 50),
        statut_commande=_safe_str(row.get('Statut Commande'), 30),
        date_facturation=_safe_date(row.get('Date Facturation')),
        code_produit=_safe_str(row.get('Code Produit'), 30),
        description_produit=_safe_str(row.get('Description Produit'), 200),
        famille=_safe_str(row.get('Famille'), 50),
        sous_famille=_safe_str(row.get('Sous Famille'), 80),
        uom_vente=_safe_str(row.get('UOM Vente'), 20),
        prix_unitaire=_safe_float(row.get('Prix Unitaire')),
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


@router.post("/upload", response_model=UploadResponse)
async def upload_ventes(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    content = await file.read()

    try:
        df = parse_file(content, file.filename or '')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Impossible de lire le fichier : {e}")

    df = df.dropna(subset=['Date'])
    if df.empty:
        raise HTTPException(status_code=400, detail="Aucune ligne valide trouvée dans le fichier")

    months_in_file = df['Date'].dt.strftime('%Y-%m').unique().tolist()

    # Reject if any of those months already exist in DB
    existing = session.exec(
        select(Vente.annee_mois).where(Vente.annee_mois.in_(months_in_file)).distinct()
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Les données pour {existing} sont déjà importées",
        )

    # Build and insert rows
    ventes = []
    for _, row in df.iterrows():
        date_val = row.get('Date')
        if pd.isna(date_val):
            continue
        row_month = date_val.strftime('%Y-%m')
        ventes.append(_row_to_vente(row, row_month, current_user.id))

    session.add_all(ventes)
    session.commit()

    dominant_month = df['Date'].dt.strftime('%Y-%m').value_counts().idxmax()
    return UploadResponse(
        lignes=len(ventes),
        annee_mois=dominant_month,
        message=f"{len(ventes):,} lignes importées pour {dominant_month}",
    )


@router.get("/periodes", response_model=List[str])
def list_periodes(session: Session = Depends(get_session)) -> Any:
    """Returns list of months that have data, most recent first."""
    result = session.exec(
        select(Vente.annee_mois).distinct().order_by(Vente.annee_mois.desc())
    ).all()
    return list(result)
