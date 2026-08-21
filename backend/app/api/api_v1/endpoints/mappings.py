from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.produit_bl_mapping import ProduitBlMapping, ProduitBlMappingCreate, ProduitBlMappingRead

router = APIRouter()


@router.get("", response_model=List[ProduitBlMappingRead])
def list_mappings(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(select(ProduitBlMapping).order_by(ProduitBlMapping.bl_code)).all()


@router.post("", response_model=ProduitBlMappingRead)
def create_mapping(
    body: ProduitBlMappingCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    mapping = ProduitBlMapping(bl_code=body.bl_code.strip(), code_produit=body.code_produit.strip())
    merged = session.merge(mapping)  # upsert — update if bl_code already exists
    session.commit()
    session.refresh(merged)
    return merged


@router.delete("/{bl_code}")
def delete_mapping(
    bl_code: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    mapping = session.get(ProduitBlMapping, bl_code)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    session.delete(mapping)
    session.commit()
    return {"ok": True}
