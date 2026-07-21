from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.client import Client
from app.models.user import User
from app.models.expedition import Expedition, ExpeditionCreate, ExpeditionUpdate, ExpeditionRead, ExpeditionVerify
from app.models.retour import Retour, RetourCreate, RetourRead
from app.models.livraison_detail import (
    ExpeditionClient, LivraisonDetail,
    LivraisonDetailCreate, LivraisonDetailRead, ExpeditionClientRead,
)

router = APIRouter()


def _attach_retours(expeditions: list[Expedition], session: Session) -> list[ExpeditionRead]:
    """Batch-fetch retour aggregates and attach to ExpeditionRead objects."""
    exp_ids = [e.id for e in expeditions]
    retour_map: dict[int, tuple[int, int, int, int, int, int]] = {}
    if exp_ids:
        rows = session.exec(
            select(
                Retour.expedition_id,
                func.coalesce(func.sum(Retour.retour_plastique), 0),
                func.coalesce(func.sum(Retour.consigne_paid_plastique), 0),
                func.coalesce(func.sum(Retour.palette_dette_plastique), 0),
                func.coalesce(func.sum(Retour.retour_bois), 0),
                func.coalesce(func.sum(Retour.consigne_paid_bois), 0),
                func.coalesce(func.sum(Retour.palette_dette_bois), 0),
            )
            .where(Retour.expedition_id.in_(exp_ids))
            .group_by(Retour.expedition_id)
        ).all()
        retour_map = {r[0]: (int(r[1]), int(r[2]), int(r[3]), int(r[4]), int(r[5]), int(r[6])) for r in rows}

    result = []
    for e in expeditions:
        er = ExpeditionRead.model_validate(e)
        rp, cp, dp, rb, cb, db = retour_map.get(e.id, (0, 0, 0, 0, 0, 0))
        er.retour_plastique        = rp
        er.consigne_paid_plastique = cp
        er.palette_dette_plastique = dp
        er.retour_bois             = rb
        er.consigne_paid_bois      = cb
        er.palette_dette_bois      = db
        result.append(er)
    return result


@router.get("", response_model=List[ExpeditionRead])
def list_expeditions(
    client_id: Optional[int] = None,
    chauffeur_id: Optional[int] = None,
    livreur_id: Optional[int] = None,
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    session: Session = Depends(get_session),
) -> Any:
    q = select(Expedition)
    if client_id:
        q = q.where(Expedition.client_id == client_id)
    if chauffeur_id:
        q = q.where(Expedition.chauffeur_id == chauffeur_id)
    if livreur_id:
        q = q.where(Expedition.livreur_id == livreur_id)
    if search:
        term = f"%{search}%"
        q = q.where(
            Expedition.bl_number.ilike(term)
            | Expedition.client_name.ilike(term)
            | Expedition.livreur_name.ilike(term)
            | Expedition.chauffeur_name.ilike(term)
        )
    if date_from:
        q = q.where(Expedition.date >= date_from)
    if date_to:
        q = q.where(Expedition.date <= date_to)
    expeditions = session.exec(
        q.order_by(Expedition.date.desc(), Expedition.id.desc()).offset(skip).limit(limit)
    ).all()
    return _attach_retours(list(expeditions), session)


@router.post("", response_model=ExpeditionRead, status_code=201)
def create_expedition(
    exp_in: ExpeditionCreate,
    session: Session = Depends(get_session),
) -> Any:
    chauffeur = None
    if exp_in.chauffeur_id:
        chauffeur = session.get(User, exp_in.chauffeur_id)
        if not chauffeur:
            raise HTTPException(status_code=404, detail="Chauffeur introuvable")

    existing = session.exec(
        select(Expedition).where(Expedition.bl_number == exp_in.bl_number)
    ).first()
    if existing:
        raise HTTPException(status_code=422, detail=f"Le numéro « {exp_in.bl_number} » existe déjà")

    creator = None
    if exp_in.created_by_id:
        creator = session.get(User, exp_in.created_by_id)

    exp_data: dict = dict(
        bl_number=exp_in.bl_number,
        date=exp_in.date,
        destination_type=exp_in.destination_type,
        chauffeur_id=exp_in.chauffeur_id,
        chauffeur_name=chauffeur.full_name if chauffeur else None,
        nc_plastique=max(0, exp_in.nc_plastique),
        nc_bois=max(0, exp_in.nc_bois),
        notes=exp_in.notes,
        created_by_id=exp_in.created_by_id,
        created_by_name=creator.full_name if creator else None,
    )

    if exp_in.destination_type == "gros":
        if not exp_in.client_id:
            raise HTTPException(status_code=422, detail="client_id requis pour une expédition Gros")
        client = session.get(Client, exp_in.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")
        exp_data.update(client_id=client.id, client_name=client.name, client_code=client.code)
    else:
        if not exp_in.livreur_id:
            raise HTTPException(status_code=422, detail="livreur_id requis pour une expédition Détail/Horeca")
        livreur = session.get(User, exp_in.livreur_id)
        if not livreur:
            raise HTTPException(status_code=404, detail="Livreur introuvable")
        exp_data.update(livreur_id=livreur.id, livreur_name=livreur.full_name)

    exp = Expedition(**exp_data)
    session.add(exp)
    session.commit()
    session.refresh(exp)

    if exp_in.destination_type != "gros" and exp_in.client_ids:
        for cid in exp_in.client_ids:
            client = session.get(Client, cid)
            if client:
                ec = ExpeditionClient(
                    expedition_id=exp.id,
                    client_id=client.id,
                    client_name=client.name,
                    client_code=client.code,
                )
                session.add(ec)
        session.commit()

    return _attach_retours([exp], session)[0]


@router.patch("/{expedition_id}", response_model=ExpeditionRead)
def update_expedition(
    expedition_id: int,
    exp_in: ExpeditionUpdate,
    session: Session = Depends(get_session),
) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")

    data = exp_in.model_dump(exclude_unset=True)

    if "client_id" in data and data["client_id"] is not None:
        client = session.get(Client, data["client_id"])
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")
        exp.client_name = client.name
        exp.client_code = client.code

    if "livreur_id" in data and data["livreur_id"] is not None:
        livreur = session.get(User, data["livreur_id"])
        if not livreur:
            raise HTTPException(status_code=404, detail="Livreur introuvable")
        exp.livreur_name = livreur.full_name

    if "chauffeur_id" in data:
        chauffeur = session.get(User, data["chauffeur_id"])
        if not chauffeur:
            raise HTTPException(status_code=404, detail="Chauffeur introuvable")
        exp.chauffeur_name = chauffeur.full_name

    for k, v in data.items():
        if v is not None:
            setattr(exp, k, max(0, v) if isinstance(v, int) else v)

    exp.updated_at = datetime.now(timezone.utc)
    session.add(exp)
    session.commit()
    session.refresh(exp)
    return _attach_retours([exp], session)[0]


@router.delete("/{expedition_id}", status_code=204)
def delete_expedition(
    expedition_id: int,
    session: Session = Depends(get_session),
) -> None:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    session.delete(exp)
    session.commit()


@router.get("/stats/dashboard")
def dashboard_stats(session: Session = Depends(get_session)) -> Any:
    from app.models.client import Client as ClientModel
    from datetime import date

    total_clients = session.exec(select(func.count(ClientModel.id))).one()

    sent_row = session.exec(
        select(
            func.coalesce(func.sum(Expedition.nc_plastique), 0),
            func.coalesce(func.sum(Expedition.nc_bois), 0),
        )
    ).one()

    retour_row = session.exec(
        select(
            func.coalesce(func.sum(Retour.retour_plastique), 0),
            func.coalesce(func.sum(Retour.retour_bois), 0),
        )
    ).one()

    today = date.today().isoformat()
    today_count = session.exec(
        select(func.count(Expedition.id)).where(Expedition.date == today)
    ).one()
    total_expeditions = session.exec(select(func.count(Expedition.id))).one()

    return {
        "total_clients":         int(total_clients),
        "total_bls":             int(total_expeditions),
        "today_bls":             int(today_count),
        "total_plastic_balance": max(0, int(sent_row[0]) - int(retour_row[0])),
        "total_wood_balance":    max(0, int(sent_row[1]) - int(retour_row[1])),
    }


@router.get("/{expedition_id}", response_model=ExpeditionRead)
def get_expedition(expedition_id: int, session: Session = Depends(get_session)) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    return _attach_retours([exp], session)[0]


@router.put("/{expedition_id}/expedition-clients")
def set_expedition_clients(
    expedition_id: int,
    client_ids: List[int],
    session: Session = Depends(get_session),
) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    existing = session.exec(
        select(ExpeditionClient).where(ExpeditionClient.expedition_id == expedition_id)
    ).all()
    for ec in existing:
        session.delete(ec)
    for cid in client_ids:
        client = session.get(Client, cid)
        if client:
            session.add(ExpeditionClient(expedition_id=expedition_id, client_id=client.id, client_name=client.name))
    session.commit()
    return {"ok": True}


@router.get("/{expedition_id}/expedition-clients", response_model=List[ExpeditionClientRead])
def get_expedition_clients(expedition_id: int, session: Session = Depends(get_session)) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")

    exp_clients = session.exec(
        select(ExpeditionClient).where(ExpeditionClient.expedition_id == expedition_id)
    ).all()

    details_map = {
        d.client_id: d
        for d in session.exec(
            select(LivraisonDetail).where(LivraisonDetail.expedition_id == expedition_id)
        ).all()
    }

    result = []
    for ec in exp_clients:
        ec_read = ExpeditionClientRead.model_validate(ec)
        client = session.get(Client, ec.client_id)
        ec_read.has_location = bool(client and client.latitude is not None and client.longitude is not None)
        if client:
            ec_read.client_first_name = client.first_name
            ec_read.client_last_name = client.last_name
        d = details_map.get(ec.client_id)
        ec_read.detail = LivraisonDetailRead.model_validate(d) if d else None
        result.append(ec_read)
    return result


@router.post("/{expedition_id}/confirm-livraison", response_model=ExpeditionRead)
def confirm_livraison(expedition_id: int, session: Session = Depends(get_session)) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    exp.livreur_confirmed = True
    exp.livreur_confirmed_at = datetime.now(timezone.utc)
    exp.updated_at = datetime.now(timezone.utc)
    session.add(exp)
    session.commit()
    session.refresh(exp)
    return _attach_retours([exp], session)[0]


@router.post("/{expedition_id}/verify", response_model=ExpeditionRead)
def verify_expedition(
    expedition_id: int,
    body: ExpeditionVerify,
    session: Session = Depends(get_session),
) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    if exp.destination_type == "gros":
        raise HTTPException(status_code=422, detail="Vérification non applicable aux expéditions Gros")

    verifier = session.get(User, body.verified_by_id)
    if not verifier:
        raise HTTPException(status_code=404, detail="Vérificateur introuvable")

    exp.retour_livreur_plastique = max(0, body.retour_livreur_plastique)
    exp.retour_livreur_bois      = max(0, body.retour_livreur_bois)
    exp.is_verified              = True
    exp.verified_at              = datetime.now(timezone.utc)
    exp.verified_by_name         = verifier.full_name
    exp.updated_at               = datetime.now(timezone.utc)

    session.add(exp)
    session.commit()
    session.refresh(exp)
    return _attach_retours([exp], session)[0]


@router.post("/{expedition_id}/details", response_model=LivraisonDetailRead, status_code=201)
def upsert_livraison_detail(
    expedition_id: int,
    body: LivraisonDetailCreate,
    session: Session = Depends(get_session),
) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")

    client = session.get(Client, body.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    existing = session.exec(
        select(LivraisonDetail).where(
            LivraisonDetail.expedition_id == expedition_id,
            LivraisonDetail.client_id == body.client_id,
        )
    ).first()

    if existing:
        existing.plastique = max(0, body.plastique)
        existing.bois = max(0, body.bois)
        existing.retour_plastique = max(0, body.retour_plastique)
        existing.retour_bois = max(0, body.retour_bois)
        existing.notes = body.notes
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return LivraisonDetailRead.model_validate(existing)

    detail = LivraisonDetail(
        expedition_id=expedition_id,
        client_id=client.id,
        client_name=client.name,
        client_code=client.code,
        plastique=max(0, body.plastique),
        bois=max(0, body.bois),
        retour_plastique=max(0, body.retour_plastique),
        retour_bois=max(0, body.retour_bois),
        notes=body.notes,
    )
    session.add(detail)
    session.commit()
    session.refresh(detail)
    return LivraisonDetailRead.model_validate(detail)


@router.post("/{expedition_id}/retours", response_model=RetourRead, status_code=201)
def create_retour(
    expedition_id: int,
    body: RetourCreate,
    session: Session = Depends(get_session),
) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")

    # Compute running totals (previous retours + this one)
    prev = session.exec(
        select(
            func.coalesce(func.sum(Retour.retour_plastique), 0),
            func.coalesce(func.sum(Retour.consigne_paid_plastique), 0),
            func.coalesce(func.sum(Retour.retour_bois), 0),
            func.coalesce(func.sum(Retour.consigne_paid_bois), 0),
        ).where(Retour.expedition_id == expedition_id)
    ).one()

    total_rp = int(prev[0]) + body.retour_plastique
    total_cp = int(prev[1]) + body.consigne_paid_plastique
    total_rb = int(prev[2]) + body.retour_bois
    total_cb = int(prev[3]) + body.consigne_paid_bois

    dette_p = max(0, exp.nc_plastique - total_rp - total_cp)
    dette_b = max(0, exp.nc_bois - total_rb - total_cb)

    retour = Retour(
        expedition_id=expedition_id,
        date=body.date,
        retour_plastique=max(0, body.retour_plastique),
        consigne_paid_plastique=max(0, body.consigne_paid_plastique),
        palette_dette_plastique=dette_p,
        retour_bois=max(0, body.retour_bois),
        consigne_paid_bois=max(0, body.consigne_paid_bois),
        palette_dette_bois=dette_b,
        notes=body.notes,
    )
    session.add(retour)

    # Mark gros expedition as returned
    if exp.destination_type == "gros":
        exp.is_returned = True
        exp.returned_at = datetime.now(timezone.utc)
        session.add(exp)

    session.commit()
    session.refresh(retour)
    return RetourRead.model_validate(retour)


@router.patch("/{expedition_id}/mark-returned", response_model=ExpeditionRead)
def mark_returned(
    expedition_id: int,
    session: Session = Depends(get_session),
) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    exp.is_returned = True
    exp.returned_at = datetime.now(timezone.utc)
    session.add(exp)
    session.commit()
    session.refresh(exp)
    return _attach_retours([exp], session)[0]


@router.get("/{expedition_id}/retours", response_model=List[RetourRead])
def list_retours(
    expedition_id: int,
    session: Session = Depends(get_session),
) -> Any:
    exp = session.get(Expedition, expedition_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    retours = session.exec(
        select(Retour).where(Retour.expedition_id == expedition_id).order_by(Retour.created_at.desc())
    ).all()
    return [RetourRead.model_validate(r) for r in retours]
