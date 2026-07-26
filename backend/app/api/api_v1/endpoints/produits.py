from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.database import get_session
from app.models.produit import Produit, ProduitPage, ProduitRead, ProduitUpdate
from app.models.vente import Vente

router = APIRouter()


@router.get("", response_model=ProduitPage)
def list_produits(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=200, ge=1, le=500),
    famille: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
) -> Any:
    conditions = []
    if famille:
        conditions.append(Produit.famille == famille)
    if search:
        term = f"%{search}%"
        conditions.append(
            Produit.description_produit.ilike(term) | Produit.code_produit.ilike(term)
        )

    count_q = select(func.count(Produit.code_produit))
    items_q = select(Produit)
    for c in conditions:
        count_q = count_q.where(c)
        items_q = items_q.where(c)

    total = session.exec(count_q).one()
    offset = (page - 1) * per_page
    items = session.exec(
        items_q.order_by(Produit.description_produit).offset(offset).limit(per_page)
    ).all()

    return ProduitPage(
        total=total,
        items=[ProduitRead.model_validate(p) for p in items],
    )


@router.get("/familles", response_model=List[str])
def list_familles(session: Session = Depends(get_session)) -> Any:
    result = session.exec(
        select(Produit.famille).distinct().order_by(Produit.famille)
    ).all()
    return [v for v in result if v]


@router.patch("/{code_produit}", response_model=ProduitRead)
def update_produit(
    code_produit: str,
    body: ProduitUpdate,
    session: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
) -> Any:
    produit = session.get(Produit, code_produit)
    if not produit:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(produit, k, v)
    from datetime import datetime, timezone
    produit.updated_at = datetime.now(timezone.utc)
    session.add(produit)
    session.commit()
    session.refresh(produit)
    return ProduitRead.model_validate(produit)


@router.post("/sync", response_model=dict)
def sync_produits(
    session: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
) -> Any:
    rows = session.exec(
        select(
            Vente.code_produit,
            Vente.description_produit,
            Vente.famille,
            Vente.sous_famille,
            Vente.uom_vente,
            Vente.uom_principale,
        )
        .where(Vente.code_produit.is_not(None))
        .distinct()
    ).all()

    inserted = 0
    for row in rows:
        existing = session.get(Produit, row.code_produit)
        if not existing:
            session.add(Produit(
                code_produit=row.code_produit,
                description_produit=row.description_produit,
                famille=row.famille,
                sous_famille=row.sous_famille,
                uom_vente=row.uom_vente,
                uom_principale=row.uom_principale,
            ))
            inserted += 1

    session.commit()
    return {"inserted": inserted, "message": f"{inserted} nouveaux produits ajoutés"}
