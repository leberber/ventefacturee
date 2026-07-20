from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.livreur import Livreur, LivreurCreate, LivreurUpdate, LivreurRead

router = APIRouter()


@router.get("", response_model=List[LivreurRead])
def list_livreurs(
    search: Optional[str] = Query(default=None),
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session),
) -> Any:
    q = select(Livreur)
    if is_active is not None:
        q = q.where(Livreur.is_active == is_active)
    if search:
        term = f"%{search}%"
        q = q.where(Livreur.name.ilike(term) | Livreur.phone.ilike(term))
    return session.exec(q.order_by(Livreur.name)).all()


@router.post("", response_model=LivreurRead, status_code=201)
def create_livreur(
    livreur_in: LivreurCreate,
    session: Session = Depends(get_session),
) -> Any:
    livreur = Livreur(**livreur_in.model_dump())
    session.add(livreur)
    session.commit()
    session.refresh(livreur)
    return livreur


@router.patch("/{livreur_id}", response_model=LivreurRead)
def update_livreur(
    livreur_id: int,
    livreur_in: LivreurUpdate,
    session: Session = Depends(get_session),
) -> Any:
    livreur = session.get(Livreur, livreur_id)
    if not livreur:
        raise HTTPException(status_code=404, detail="Livreur introuvable")

    for k, v in livreur_in.model_dump(exclude_unset=True).items():
        setattr(livreur, k, v)
    livreur.updated_at = datetime.now(timezone.utc)
    session.add(livreur)
    session.commit()
    session.refresh(livreur)
    return livreur


@router.delete("/{livreur_id}", status_code=204)
def delete_livreur(
    livreur_id: int,
    session: Session = Depends(get_session),
) -> None:
    livreur = session.get(Livreur, livreur_id)
    if not livreur:
        raise HTTPException(status_code=404, detail="Livreur introuvable")
    session.delete(livreur)
    session.commit()
