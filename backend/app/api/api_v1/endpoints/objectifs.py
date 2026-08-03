from typing import Any, Optional
from datetime import datetime, timezone, date

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, distinct
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.objectif import Objectif
from app.models.produit import Produit
from app.models.user import User
from app.models.vente import Vente

router = APIRouter()


@router.get("/next-missing")
def next_missing_month(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    # Single query: get the latest (annee, mois) in one pass
    row = session.exec(
        select(Objectif.annee, Objectif.mois)
        .where(Objectif.mois.isnot(None), Objectif.annee.isnot(None))
        .order_by(Objectif.annee.desc(), Objectif.mois.desc())
        .limit(1)
    ).first()
    if not row:
        today = date.today()
        return {"mois": today.month, "annee": today.year}
    annee, mois = row
    if mois == 12:
        return {"mois": 1, "annee": annee + 1}
    return {"mois": mois + 1, "annee": annee}


@router.get("/routes-count")
def routes_count(
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2020),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    annee_mois = f"{annee}-{mois:02d}"

    def _count_by_canal(am: str) -> dict:
        rows = session.exec(
            select(Vente.canal, func.count(distinct(Vente.code_fdv)))
            .where(
                Vente.annee_mois == am,
                Vente.canal.in_(["VD", "VH"]),
                Vente.code_fdv.isnot(None),
            )
            .group_by(Vente.canal)
        ).all()
        return {canal: int(cnt) for canal, cnt in rows}

    counts = _count_by_canal(annee_mois)
    vd = counts.get("VD", 0)
    vh = counts.get("VH", 0)

    fallback_mois = None
    if vd == 0 and vh == 0:
        latest = session.exec(
            select(Vente.annee_mois)
            .where(Vente.canal.isnot(None), Vente.code_fdv.isnot(None))
            .order_by(Vente.annee_mois.desc())
            .limit(1)
        ).first()
        if latest and latest != annee_mois:
            fallback_mois = latest
            fb = _count_by_canal(latest)
            vd = fb.get("VD", 0)
            vh = fb.get("VH", 0)

    return {"vd": vd, "vh": vh, "fallback_mois": fallback_mois}


@router.post("/batch")
def batch_upsert(
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2020),
    body: list = Body(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    now = datetime.now(timezone.utc)

    def _f(item: dict, key: str) -> Optional[float]:
        v = item.get(key)
        return float(v) if v is not None else None

    # Load all existing objectifs for this period in one query
    existing = session.exec(
        select(Objectif).where(Objectif.mois == mois, Objectif.annee == annee)
    ).all()
    obj_map = {o.code_produit: o for o in existing}

    for item in body:
        code = item.get("code_produit")
        if not code:
            continue
        obj = obj_map.get(code)
        if obj:
            obj.objectif_tonne_vd = _f(item, "objectif_tonne_vd")
            obj.objectif_packs_vd = _f(item, "objectif_packs_vd")
            obj.objectif_tonne_vh = _f(item, "objectif_tonne_vh")
            obj.objectif_packs_vh = _f(item, "objectif_packs_vh")
            obj.updated_by_id = current_user.id
            obj.updated_at = now
        else:
            session.add(Objectif(
                code_produit=code, mois=mois, annee=annee,
                objectif_tonne_vd=_f(item, "objectif_tonne_vd"),
                objectif_packs_vd=_f(item, "objectif_packs_vd"),
                objectif_tonne_vh=_f(item, "objectif_tonne_vh"),
                objectif_packs_vh=_f(item, "objectif_packs_vh"),
                created_by_id=current_user.id,
                updated_by_id=current_user.id,
                created_at=now, updated_at=now,
            ))

    session.commit()
    return {"ok": True, "saved": len(body)}


@router.get("")
def list_objectifs(
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2020),
    edit: bool = Query(default=False),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Any:
    # Single join: produits LEFT/INNER joined with objectifs for this period
    base = (
        select(Produit, Objectif)
        .order_by(Produit.famille, Produit.sous_famille, Produit.nom_produit)
    )
    if edit:
        stmt = base.outerjoin(
            Objectif,
            (Produit.code_produit == Objectif.code_produit) &
            (Objectif.mois == mois) &
            (Objectif.annee == annee),
        )
    else:
        stmt = base.join(
            Objectif,
            (Produit.code_produit == Objectif.code_produit) &
            (Objectif.mois == mois) &
            (Objectif.annee == annee),
        ).where(
            (Objectif.objectif_tonne_vd.isnot(None)) |
            (Objectif.objectif_packs_vd.isnot(None)) |
            (Objectif.objectif_tonne_vh.isnot(None)) |
            (Objectif.objectif_packs_vh.isnot(None))
        )

    rows = session.exec(stmt).all()

    # Batch-load users referenced by objectives
    user_ids = {obj.updated_by_id for _, obj in rows if obj and obj.updated_by_id}
    users_map: dict = {}
    if user_ids:
        users = session.exec(select(User).where(User.id.in_(user_ids))).all()
        users_map = {u.id: u.full_name for u in users}

    return [
        {
            "code_produit": p.code_produit,
            "nom_produit": p.nom_produit or p.description_produit or p.code_produit,
            "famille": (p.famille or "").strip(),
            "sous_famille": (p.sous_famille or "").strip(),
            "objectif_tonne_vd": obj.objectif_tonne_vd if obj else None,
            "objectif_packs_vd": obj.objectif_packs_vd if obj else None,
            "objectif_tonne_vh": obj.objectif_tonne_vh if obj else None,
            "objectif_packs_vh": obj.objectif_packs_vh if obj else None,
            "updated_at": obj.updated_at.isoformat() if obj else None,
            "updated_by": users_map.get(obj.updated_by_id) if obj else None,
        }
        for p, obj in rows
    ]
