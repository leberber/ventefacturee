from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.client import Client, ClientCreate, ClientUpdate, ClientRead
from app.models.expedition import Expedition
from app.models.retour import Retour
from app.models.livraison_detail import LivraisonDetail

router = APIRouter()


def _compute_balance(client_id: int, session: Session) -> dict:
    # Gros: palettes sent directly to this client
    sent_row = session.exec(
        select(
            func.coalesce(func.sum(Expedition.nc_plastique), 0),
            func.coalesce(func.sum(Expedition.nc_bois), 0),
        ).where(Expedition.client_id == client_id)
    ).one()

    exp_subq = select(Expedition.id).where(Expedition.client_id == client_id).scalar_subquery()
    retour_row = session.exec(
        select(
            func.coalesce(func.sum(Retour.retour_plastique), 0),
            func.coalesce(func.sum(Retour.consigne_paid_plastique), 0),
            func.coalesce(func.sum(Retour.retour_bois), 0),
            func.coalesce(func.sum(Retour.consigne_paid_bois), 0),
        ).where(Retour.expedition_id.in_(exp_subq))
    ).one()

    # Détail/Horeca: palettes delivered to this client via verified tournées
    detail_row = session.exec(
        select(
            func.coalesce(func.sum(LivraisonDetail.plastique), 0),
            func.coalesce(func.sum(LivraisonDetail.retour_plastique), 0),
            func.coalesce(func.sum(LivraisonDetail.bois), 0),
            func.coalesce(func.sum(LivraisonDetail.retour_bois), 0),
        )
        .join(Expedition, LivraisonDetail.expedition_id == Expedition.id)
        .where(
            LivraisonDetail.client_id == client_id,
            Expedition.is_verified == True,
        )
    ).one()

    ps = int(sent_row[0]);   bs = int(sent_row[1])
    pr = int(retour_row[0]); pc = int(retour_row[1])
    br = int(retour_row[2]); bc = int(retour_row[3])
    dp = int(detail_row[0]); dr_p = int(detail_row[1])
    db = int(detail_row[2]); dr_b = int(detail_row[3])

    total_p_sent   = ps + dp
    total_p_retour = pr + dr_p
    total_b_sent   = bs + db
    total_b_retour = br + dr_b

    return {
        "plastic_sent":     total_p_sent,
        "plastic_retour":   total_p_retour,
        "plastic_consigne": pc,
        "plastic_out":      max(0, total_p_sent - total_p_retour),
        "plastic_balance":  max(0, total_p_sent - total_p_retour - pc),
        "wood_sent":        total_b_sent,
        "wood_retour":      total_b_retour,
        "wood_consigne":    bc,
        "wood_out":         max(0, total_b_sent - total_b_retour),
        "wood_balance":     max(0, total_b_sent - total_b_retour - bc),
    }


def _attach_balance(cr: ClientRead, bal: dict) -> ClientRead:
    cr.plastic_sent     = bal["plastic_sent"]
    cr.plastic_retour   = bal["plastic_retour"]
    cr.plastic_consigne = bal["plastic_consigne"]
    cr.plastic_out      = bal["plastic_out"]
    cr.plastic_balance  = bal["plastic_balance"]
    cr.wood_sent        = bal["wood_sent"]
    cr.wood_retour      = bal["wood_retour"]
    cr.wood_consigne    = bal["wood_consigne"]
    cr.wood_out         = bal["wood_out"]
    cr.wood_balance     = bal["wood_balance"]
    return cr


@router.get("", response_model=List[ClientRead])
def list_clients(
    search: Optional[str] = Query(default=None),
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session),
) -> Any:
    q = select(Client)
    if is_active is not None:
        q = q.where(Client.is_active == is_active)
    if search:
        term = f"%{search}%"
        q = q.where(
            Client.name.ilike(term)
            | Client.phone.ilike(term)
            | Client.code.ilike(term)
        )
    clients = session.exec(q.order_by(Client.name)).all()
    return [_attach_balance(ClientRead.model_validate(c), _compute_balance(c.id, session)) for c in clients]


@router.post("", response_model=ClientRead, status_code=201)
def create_client(
    client_in: ClientCreate,
    session: Session = Depends(get_session),
) -> Any:
    client = Client(**client_in.model_dump())
    session.add(client)
    session.commit()
    session.refresh(client)
    cr = ClientRead.model_validate(client)
    return _attach_balance(cr, _compute_balance(client.id, session))


@router.patch("/{client_id}", response_model=ClientRead)
def update_client(
    client_id: int,
    client_in: ClientUpdate,
    session: Session = Depends(get_session),
) -> Any:
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    for k, v in client_in.model_dump(exclude_unset=True).items():
        setattr(client, k, v)
    client.updated_at = datetime.now(timezone.utc)
    session.add(client)
    session.commit()
    session.refresh(client)

    cr = ClientRead.model_validate(client)
    return _attach_balance(cr, _compute_balance(client.id, session))


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: int,
    session: Session = Depends(get_session),
) -> None:
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    session.delete(client)
    session.commit()


@router.get("/{client_id}/balance")
def get_client_balance(
    client_id: int,
    session: Session = Depends(get_session),
) -> Any:
    if not session.get(Client, client_id):
        raise HTTPException(status_code=404, detail="Client introuvable")
    return _compute_balance(client_id, session)
