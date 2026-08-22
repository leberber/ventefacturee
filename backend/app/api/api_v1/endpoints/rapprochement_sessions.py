from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.database import get_session
from app.models.rapprochement_session import (
    RapprochementSession,
    RapprochementSessionLigne,
    SessionCreate,
    SessionRead,
    SessionReadDetail,
    SessionLigneRead,
)


class CheckResponse(BaseModel):
    exists: bool
    session: Optional[SessionRead] = None

class VersementPatch(BaseModel):
    versement: float

router = APIRouter()


@router.post("", response_model=SessionRead, status_code=201)
def create_session(payload: SessionCreate, db: Session = Depends(get_session)):
    session = RapprochementSession(
        nom_livreur=payload.nom_livreur,
        date_bl=payload.date_bl,
        source=payload.source,
        net_a_payer=payload.net_a_payer,
        net_ajuste=payload.net_ajuste,
        total_discount=payload.total_discount,
        montant_recu=payload.montant_recu,
        difference=payload.difference,
    )
    db.add(session)
    db.flush()  # get session.id before inserting lines

    for l in payload.lignes:
        ligne = RapprochementSessionLigne(
            session_id=session.id,
            **l.model_dump(),
        )
        db.add(ligne)

    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=List[SessionRead])
def list_sessions(db: Session = Depends(get_session)):
    return db.exec(
        select(RapprochementSession).order_by(RapprochementSession.created_at.desc())
    ).all()


@router.get("/check", response_model=CheckResponse)
def check_existing(nom_livreur: str, date_bl: str, db: Session = Depends(get_session)):
    existing = db.exec(
        select(RapprochementSession)
        .where(RapprochementSession.nom_livreur == nom_livreur)
        .where(RapprochementSession.date_bl == date_bl)
        .order_by(RapprochementSession.created_at.desc())
        .limit(1)
    ).first()
    if existing:
        return CheckResponse(exists=True, session=SessionRead.model_validate(existing))
    return CheckResponse(exists=False)


@router.get("/{session_id}", response_model=SessionReadDetail)
def get_session_detail(session_id: int, db: Session = Depends(get_session)):
    session = db.get(RapprochementSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    lignes = db.exec(
        select(RapprochementSessionLigne)
        .where(RapprochementSessionLigne.session_id == session_id)
    ).all()
    return SessionReadDetail(**session.model_dump(), lignes=[SessionLigneRead.model_validate(l) for l in lignes])


@router.put("/{session_id}", response_model=SessionRead)
def update_session(session_id: int, payload: SessionCreate, db: Session = Depends(get_session)):
    session = db.get(RapprochementSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.nom_livreur = payload.nom_livreur
    session.date_bl = payload.date_bl
    session.source = payload.source
    session.net_a_payer = payload.net_a_payer
    session.net_ajuste = payload.net_ajuste
    session.total_discount = payload.total_discount
    session.montant_recu = payload.montant_recu
    session.difference = payload.difference

    for ligne in db.exec(
        select(RapprochementSessionLigne)
        .where(RapprochementSessionLigne.session_id == session_id)
    ).all():
        db.delete(ligne)

    for l in payload.lignes:
        db.add(RapprochementSessionLigne(session_id=session_id, **l.model_dump()))

    db.commit()
    db.refresh(session)
    return session


@router.patch("/{session_id}/montant", response_model=SessionRead)
def patch_montant(session_id: int, payload: VersementPatch, db: Session = Depends(get_session)):
    session = db.get(RapprochementSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.montant_recu = (session.montant_recu or 0) + payload.versement
    session.difference = round(session.montant_recu - session.net_ajuste)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_session)):
    session = db.get(RapprochementSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.exec(
        select(RapprochementSessionLigne)
        .where(RapprochementSessionLigne.session_id == session_id)
    )
    # delete lines first
    for ligne in db.exec(
        select(RapprochementSessionLigne)
        .where(RapprochementSessionLigne.session_id == session_id)
    ).all():
        db.delete(ligne)
    db.delete(session)
    db.commit()
