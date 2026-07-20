from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.client import Client
from app.models.chauffeur import Chauffeur
from app.models.livreur import Livreur
from app.models.bon_de_livraison import BonDeLivraison, BLCreate, BLUpdate, BLRead

router = APIRouter()



@router.get("", response_model=List[BLRead])
def list_bls(
    client_id: Optional[int] = None,
    chauffeur_id: Optional[int] = None,
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    session: Session = Depends(get_session),
) -> Any:
    q = select(BonDeLivraison)
    if client_id:
        q = q.where(BonDeLivraison.client_id == client_id)
    if chauffeur_id:
        q = q.where(BonDeLivraison.chauffeur_id == chauffeur_id)
    if search:
        term = f"%{search}%"
        q = q.where(
            BonDeLivraison.bl_number.ilike(term)
            | BonDeLivraison.client_name.ilike(term)
            | BonDeLivraison.livreur_name.ilike(term)
            | BonDeLivraison.chauffeur_name.ilike(term)
        )
    if date_from:
        q = q.where(BonDeLivraison.date >= date_from)
    if date_to:
        q = q.where(BonDeLivraison.date <= date_to)
    bls = session.exec(q.order_by(BonDeLivraison.date.desc(), BonDeLivraison.id.desc()).offset(skip).limit(limit)).all()
    return [BLRead.model_validate(b) for b in bls]


@router.post("", response_model=BLRead, status_code=201)
def create_bl(
    bl_in: BLCreate,
    session: Session = Depends(get_session),
) -> Any:
    chauffeur = session.get(Chauffeur, bl_in.chauffeur_id)
    if not chauffeur:
        raise HTTPException(status_code=404, detail="Chauffeur introuvable")

    existing = session.exec(select(BonDeLivraison).where(BonDeLivraison.bl_number == bl_in.bl_number)).first()
    if existing:
        raise HTTPException(status_code=422, detail=f"Le numéro BL « {bl_in.bl_number} » existe déjà")

    bl_data: dict = dict(
        bl_number=bl_in.bl_number,
        date=bl_in.date,
        destination_type=bl_in.destination_type,
        chauffeur_id=bl_in.chauffeur_id,
        chauffeur_name=chauffeur.name,
        consigne_plastique=max(0, bl_in.consigne_plastique),
        nc_plastique=max(0, bl_in.nc_plastique),
        retour_plastique=max(0, bl_in.retour_plastique),
        consigne_bois=max(0, bl_in.consigne_bois),
        nc_bois=max(0, bl_in.nc_bois),
        retour_bois=max(0, bl_in.retour_bois),
        notes=bl_in.notes,
    )

    if bl_in.destination_type == "gros":
        if not bl_in.client_id:
            raise HTTPException(status_code=422, detail="client_id requis pour une expédition Gros")
        client = session.get(Client, bl_in.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")
        bl_data.update(client_id=client.id, client_name=client.name, client_code=client.code)
    else:
        if not bl_in.livreur_id:
            raise HTTPException(status_code=422, detail="livreur_id requis pour une expédition Détail/Horeca")
        livreur = session.get(Livreur, bl_in.livreur_id)
        if not livreur:
            raise HTTPException(status_code=404, detail="Livreur introuvable")
        bl_data.update(livreur_id=livreur.id, livreur_name=livreur.name)

    bl = BonDeLivraison(**bl_data)
    session.add(bl)
    session.commit()
    session.refresh(bl)
    return BLRead.model_validate(bl)


@router.patch("/{bl_id}", response_model=BLRead)
def update_bl(
    bl_id: int,
    bl_in: BLUpdate,
    session: Session = Depends(get_session),
) -> Any:
    bl = session.get(BonDeLivraison, bl_id)
    if not bl:
        raise HTTPException(status_code=404, detail="BL introuvable")

    data = bl_in.model_dump(exclude_unset=True)

    # If client changed, update snapshots
    if "client_id" in data and data["client_id"] is not None:
        client = session.get(Client, data["client_id"])
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")
        bl.client_name = client.name
        bl.client_code = client.code

    # If livreur changed, update snapshot
    if "livreur_id" in data and data["livreur_id"] is not None:
        livreur = session.get(Livreur, data["livreur_id"])
        if not livreur:
            raise HTTPException(status_code=404, detail="Livreur introuvable")
        bl.livreur_name = livreur.name

    # If chauffeur changed, update snapshot
    if "chauffeur_id" in data:
        chauffeur = session.get(Chauffeur, data["chauffeur_id"])
        if not chauffeur:
            raise HTTPException(status_code=404, detail="Chauffeur introuvable")
        bl.chauffeur_name = chauffeur.name

    for k, v in data.items():
        if v is not None:
            setattr(bl, k, max(0, v) if isinstance(v, int) else v)

    bl.updated_at = datetime.now(timezone.utc)
    session.add(bl)
    session.commit()
    session.refresh(bl)
    return BLRead.model_validate(bl)


@router.delete("/{bl_id}", status_code=204)
def delete_bl(
    bl_id: int,
    session: Session = Depends(get_session),
) -> None:
    bl = session.get(BonDeLivraison, bl_id)
    if not bl:
        raise HTTPException(status_code=404, detail="BL introuvable")
    session.delete(bl)
    session.commit()


@router.get("/stats/dashboard")
def dashboard_stats(session: Session = Depends(get_session)) -> Any:
    from app.models.client import Client as ClientModel

    total_clients = session.exec(select(func.count(ClientModel.id))).one()

    pal_row = session.exec(
        select(
            func.coalesce(func.sum(BonDeLivraison.consigne_plastique + BonDeLivraison.nc_plastique - BonDeLivraison.retour_plastique), 0),
            func.coalesce(func.sum(BonDeLivraison.consigne_bois + BonDeLivraison.nc_bois - BonDeLivraison.retour_bois), 0),
            func.coalesce(func.sum(BonDeLivraison.consigne_plastique), 0),
            func.coalesce(func.sum(BonDeLivraison.nc_plastique), 0),
            func.coalesce(func.sum(BonDeLivraison.consigne_bois), 0),
            func.coalesce(func.sum(BonDeLivraison.nc_bois), 0),
        )
    ).one()

    from datetime import date
    today = date.today().isoformat()
    today_count = session.exec(
        select(func.count(BonDeLivraison.id)).where(BonDeLivraison.date == today)
    ).one()

    total_bls = session.exec(select(func.count(BonDeLivraison.id))).one()

    return {
        "total_clients":            int(total_clients),
        "total_bls":                int(total_bls),
        "today_bls":                int(today_count),
        "total_plastic_balance":    max(0, int(pal_row[0])),
        "total_wood_balance":       max(0, int(pal_row[1])),
        "total_plastic_consigne":   int(pal_row[2]),
        "total_plastic_nc":         int(pal_row[3]),
        "total_wood_consigne":      int(pal_row[4]),
        "total_wood_nc":            int(pal_row[5]),
    }
