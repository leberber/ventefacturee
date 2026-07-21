from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.chauffeur import Chauffeur, ChauffeurCreate, ChauffeurUpdate, ChauffeurRead
from app.models.expedition import Expedition

router = APIRouter()


@router.get("", response_model=List[ChauffeurRead])
def list_chauffeurs(
    search: Optional[str] = Query(default=None),
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session),
) -> Any:
    q = select(Chauffeur)
    if is_active is not None:
        q = q.where(Chauffeur.is_active == is_active)
    if search:
        term = f"%{search}%"
        q = q.where(Chauffeur.name.ilike(term) | Chauffeur.phone.ilike(term))
    chauffeurs = session.exec(q.order_by(Chauffeur.name)).all()

    # Batch BL counts
    ids = [c.id for c in chauffeurs]
    counts = {}
    if ids:
        rows = session.exec(
            select(Expedition.chauffeur_id, func.count(Expedition.id))
            .where(Expedition.chauffeur_id.in_(ids))
            .group_by(Expedition.chauffeur_id)
        ).all()
        counts = {r[0]: r[1] for r in rows}

    result = []
    for c in chauffeurs:
        cr = ChauffeurRead.model_validate(c)
        cr.bl_count = counts.get(c.id, 0)
        result.append(cr)
    return result


@router.post("", response_model=ChauffeurRead, status_code=201)
def create_chauffeur(
    chauffeur_in: ChauffeurCreate,
    session: Session = Depends(get_session),
) -> Any:
    chauffeur = Chauffeur(**chauffeur_in.model_dump())
    session.add(chauffeur)
    session.commit()
    session.refresh(chauffeur)
    cr = ChauffeurRead.model_validate(chauffeur)
    cr.bl_count = 0
    return cr


@router.patch("/{chauffeur_id}", response_model=ChauffeurRead)
def update_chauffeur(
    chauffeur_id: int,
    chauffeur_in: ChauffeurUpdate,
    session: Session = Depends(get_session),
) -> Any:
    chauffeur = session.get(Chauffeur, chauffeur_id)
    if not chauffeur:
        raise HTTPException(status_code=404, detail="Chauffeur introuvable")

    for k, v in chauffeur_in.model_dump(exclude_unset=True).items():
        setattr(chauffeur, k, v)
    chauffeur.updated_at = datetime.now(timezone.utc)
    session.add(chauffeur)
    session.commit()
    session.refresh(chauffeur)

    cr = ChauffeurRead.model_validate(chauffeur)
    cr.bl_count = session.exec(
        select(func.count(Expedition.id)).where(Expedition.chauffeur_id == chauffeur_id)
    ).one()
    return cr


@router.delete("/{chauffeur_id}", status_code=204)
def delete_chauffeur(
    chauffeur_id: int,
    session: Session = Depends(get_session),
) -> None:
    chauffeur = session.get(Chauffeur, chauffeur_id)
    if not chauffeur:
        raise HTTPException(status_code=404, detail="Chauffeur introuvable")
    session.delete(chauffeur)
    session.commit()
