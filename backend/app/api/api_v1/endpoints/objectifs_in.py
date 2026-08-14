from typing import Any
from datetime import datetime, timezone, date
import io

from fastapi import APIRouter, Body, Depends, File, Query, UploadFile
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.objectif_in import ObjectifIn
from app.models.produit import Produit
from app.models.user import User

router = APIRouter()


@router.get("/next-missing")
def next_missing_month(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    row = session.exec(
        select(ObjectifIn.annee, ObjectifIn.mois)
        .where(ObjectifIn.mois.isnot(None), ObjectifIn.annee.isnot(None))
        .order_by(ObjectifIn.annee.desc(), ObjectifIn.mois.desc())
        .limit(1)
    ).first()
    if not row:
        today = date.today()
        return {"mois": today.month, "annee": today.year}
    annee, mois = row
    if mois == 12:
        return {"mois": 1, "annee": annee + 1}
    return {"mois": mois + 1, "annee": annee}


@router.get("")
def list_objectifs_in(
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2020),
    edit: bool = Query(default=False),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    base = (
        select(Produit, ObjectifIn)
        .order_by(Produit.famille, Produit.sous_famille, Produit.description_produit)
    )
    if edit:
        stmt = base.outerjoin(
            ObjectifIn,
            (Produit.code_produit == ObjectifIn.code_produit) &
            (ObjectifIn.mois == mois) &
            (ObjectifIn.annee == annee),
        )
    else:
        stmt = base.join(
            ObjectifIn,
            (Produit.code_produit == ObjectifIn.code_produit) &
            (ObjectifIn.mois == mois) &
            (ObjectifIn.annee == annee),
        ).where(ObjectifIn.objectif_tonne.isnot(None))

    rows = session.exec(stmt).all()

    user_ids = {obj.updated_by_id for _, obj in rows if obj and obj.updated_by_id}
    users_map: dict = {}
    if user_ids:
        users = session.exec(select(User).where(User.id.in_(user_ids))).all()
        users_map = {u.id: u.full_name for u in users}

    return [
        {
            "code_produit": p.code_produit,
            "nom_produit": p.description_produit or p.nom_produit or p.code_produit,
            "famille": (p.famille or "").strip(),
            "sous_famille": (p.sous_famille or "").strip(),
            "objectif_tonne": obj.objectif_tonne if obj else None,
            "updated_at": obj.updated_at.isoformat() if obj else None,
            "updated_by": users_map.get(obj.updated_by_id) if obj else None,
        }
        for p, obj in rows
    ]


@router.post("/batch")
def batch_upsert(
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2020),
    body: list = Body(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    now = datetime.now(timezone.utc)

    # Resolve code_dd aliases → canonical code_produit
    dd_map = {p.code_dd: p.code_produit
              for p in session.exec(select(Produit).where(Produit.code_dd.isnot(None))).all()}

    existing = session.exec(
        select(ObjectifIn).where(ObjectifIn.mois == mois, ObjectifIn.annee == annee)
    ).all()
    obj_map = {o.code_produit: o for o in existing}

    for item in body:
        code = item.get("code_produit")
        if not code:
            continue
        code = dd_map.get(code, code)
        tonne = float(item["objectif_tonne"]) if item.get("objectif_tonne") is not None else None

        obj = obj_map.get(code)
        if obj:
            obj.objectif_tonne = tonne
            obj.updated_by_id = current_user.id
            obj.updated_at = now
        elif tonne is not None:
            session.add(ObjectifIn(
                code_produit=code, mois=mois, annee=annee,
                objectif_tonne=tonne,
                created_by_id=current_user.id,
                updated_by_id=current_user.id,
                created_at=now, updated_at=now,
            ))

    session.commit()
    return {"ok": True, "saved": len(body)}


@router.post("/parse-excel")
async def parse_excel(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    import openpyxl
    dd_map = {p.code_dd: p.code_produit
              for p in session.exec(select(Produit).where(Produit.code_dd.isnot(None))).all()}

    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    result = []
    header_skipped = False
    for row in ws.iter_rows(values_only=True):
        if not header_skipped:
            header_skipped = True
            continue
        code = row[0]
        tonne = row[2] if len(row) > 2 else None
        if not code or not isinstance(code, str) or not code.strip():
            continue
        code = code.strip()
        code = dd_map.get(code, code)
        result.append({
            "code_produit": code,
            "tonne": float(tonne) if tonne is not None else None,
        })
    return result
