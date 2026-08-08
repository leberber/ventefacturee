from typing import Any, List
from datetime import datetime, timezone
import io

from fastapi import APIRouter, Depends, File, Query, UploadFile, HTTPException
from sqlmodel import Session, select, delete

from app.api.deps import get_current_user
from app.database import get_session
from app.models.entree_in import EntreeIn
from app.models.objectif_in import ObjectifIn
from app.models.produit import Produit
from app.models.user import User

router = APIRouter()


def _parse_excel_bytes(content: bytes) -> List[tuple]:
    """Parse Excel bytes → list of (code_upper, date, nb_colis). Raises HTTPException on error."""
    import openpyxl
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Fichier Excel invalide")

    ws = wb.active
    entries: List[tuple] = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        code    = row[1]   # col B
        date_val = row[6]  # col G
        nb_colis = row[7]  # col H

        if not code or not date_val or nb_colis is None:
            continue
        if not isinstance(code, str) or not code.strip():
            continue
        if not isinstance(date_val, datetime):
            continue
        try:
            qty = float(nb_colis)
        except (TypeError, ValueError):
            continue

        entries.append((code.strip().upper(), date_val.date(), qty))

    return entries


@router.post("/parse")
async def parse_entrees(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Parse Excel and return a preview — no DB writes."""
    content = await file.read()
    entries = _parse_excel_bytes(content)

    if not entries:
        raise HTTPException(status_code=400, detail="Aucune ligne valide trouvée dans le fichier")

    dates_found = sorted({str(e[1]) for e in entries})

    # Look up product info
    codes = {e[0] for e in entries}
    produits = session.exec(select(Produit).where(Produit.code_produit.in_(codes))).all()
    produit_map = {p.code_produit: p for p in produits}
    unknown_codes = sorted(codes - produit_map.keys())

    # Check if those dates already have data in DB
    from datetime import date as date_type
    date_objects = [date_type.fromisoformat(d) for d in dates_found]
    existing = session.exec(
        select(EntreeIn.date, EntreeIn.code_produit)
        .where(EntreeIn.date.in_(date_objects))
    ).all()
    existing_by_date: dict[str, int] = {}
    for e_date, _ in existing:
        key = str(e_date)
        existing_by_date[key] = existing_by_date.get(key, 0) + 1

    # Build preview rows
    preview = []
    for code, entry_date, qty in entries:
        p = produit_map.get(code)
        col_pal = p.colisage_palette if p else None
        poids   = p.poids_unite_vente if p else None
        nb_pal  = round(qty / col_pal, 2) if col_pal else None
        tonnes  = round(qty * poids, 3)   if poids   else None
        preview.append({
            "code_produit":   code,
            "nom_produit":    (p.description_produit or p.nom_produit or code) if p else code,
            "famille":        (p.famille or "").strip() if p else "",
            "date":           str(entry_date),
            "quantite_colis": qty,
            "nb_palettes":    nb_pal,
            "tonnes":         tonnes,
            "known":          p is not None,
        })

    return {
        "dates":            dates_found,
        "total_entries":    len(entries),
        "unknown_codes":    unknown_codes,
        "existing_by_date": existing_by_date,
        "preview":          preview,
    }


@router.post("/upload")
async def upload_entrees(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    content = await file.read()
    entries = _parse_excel_bytes(content)

    if not entries:
        raise HTTPException(status_code=400, detail="Aucune ligne valide trouvée dans le fichier")

    dates_found = {e[1] for e in entries}

    # Overwrite: delete all records for dates found in file
    for d in dates_found:
        session.exec(delete(EntreeIn).where(EntreeIn.date == d))

    now = datetime.now(timezone.utc)
    for code, d, qty in entries:
        session.add(EntreeIn(
            code_produit=code,
            date=d,
            quantite_colis=qty,
            created_by_id=current_user.id,
            created_at=now,
        ))

    session.commit()
    return {
        "imported": len(entries),
        "dates": sorted(str(d) for d in dates_found),
    }


@router.get("/month")
def get_month(
    annee_mois: str = Query(..., regex=r"^\d{4}-\d{2}$"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        annee = int(annee_mois[:4])
        mois = int(annee_mois[5:7])
    except ValueError:
        raise HTTPException(status_code=400, detail="Format annee_mois invalide")

    from sqlalchemy import extract
    # Fetch all entrees for this month
    entrees = session.exec(
        select(EntreeIn).where(
            extract("year", EntreeIn.date) == annee,
            extract("month", EntreeIn.date) == mois,
        )
    ).all()

    # Get all product codes present in entrees
    codes_in_entrees = {e.code_produit for e in entrees}

    # Get produit data for all codes in entrees
    produits = session.exec(
        select(Produit)
    ).all()
    produit_map = {p.code_produit: p for p in produits}

    # Get objectifs for this month
    objectifs = session.exec(
        select(ObjectifIn).where(
            ObjectifIn.mois == mois,
            ObjectifIn.annee == annee,
        )
    ).all()
    objectif_map = {o.code_produit: o.objectif_tonne for o in objectifs}

    # Build per-product day map
    # key: code_produit -> {day: qty_colis}
    from collections import defaultdict
    product_days: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    days_set: set[int] = set()

    for e in entrees:
        day = e.date.day
        days_set.add(day)
        product_days[e.code_produit][day] += e.quantite_colis

    days = sorted(days_set)

    # Build rows — only products that have entrees
    rows = []
    for code in sorted(codes_in_entrees):
        p = produit_map.get(code)
        day_data = product_days[code]
        total_colis = sum(day_data.values())

        # Convert to palettes
        colisage_palette = p.colisage_palette if p else None
        total_palettes = total_colis / colisage_palette if colisage_palette else None

        # Convert to tonnes: poids_unite_vente is already tonnes-per-colis
        poids = p.poids_unite_vente if p else None
        colisage = p.colisage if p else None
        if poids:
            total_tonne = total_colis * poids
        else:
            total_tonne = None

        rows.append({
            "code_produit": code,
            "nom_produit": (p.description_produit or p.nom_produit or code) if p else code,
            "famille": (p.famille or "").strip() if p else "",
            "sous_famille": (p.sous_famille or "").strip() if p else "",
            "colisage": colisage,
            "colisage_palette": colisage_palette,
            "poids_unite_vente": poids,
            "objectif_tonne": objectif_map.get(code),
            "days": {str(d): day_data.get(d, 0) for d in days},
            "total_colis": total_colis,
            "total_palettes": round(total_palettes, 2) if total_palettes is not None else None,
            "total_tonne": round(total_tonne, 3) if total_tonne is not None else None,
        })

    # Sort by famille, sous_famille, nom_produit
    rows.sort(key=lambda r: (r["famille"], r["sous_famille"], r["nom_produit"]))

    # Compute uploaded dates
    uploaded_dates = sorted({str(e.date) for e in entrees})

    return {
        "annee_mois": annee_mois,
        "days": days,
        "uploaded_dates": uploaded_dates,
        "rows": rows,
    }


@router.delete("/date")
def delete_date(
    date_str: str = Query(..., alias="date"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    from datetime import date as date_type
    try:
        d = date_type.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format date invalide (YYYY-MM-DD)")

    result = session.exec(delete(EntreeIn).where(EntreeIn.date == d))
    session.commit()
    return {"deleted": result.rowcount, "date": date_str}
