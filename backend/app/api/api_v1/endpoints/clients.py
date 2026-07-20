from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.client import Client, ClientCreate, ClientUpdate, ClientRead
from app.models.bon_de_livraison import BonDeLivraison

router = APIRouter()


def _compute_balance(client_id: int, session: Session) -> dict:
    row = session.exec(
        select(
            func.coalesce(func.sum(BonDeLivraison.consigne_plastique), 0),
            func.coalesce(func.sum(BonDeLivraison.nc_plastique), 0),
            func.coalesce(func.sum(BonDeLivraison.retour_plastique), 0),
            func.coalesce(func.sum(BonDeLivraison.consigne_bois), 0),
            func.coalesce(func.sum(BonDeLivraison.nc_bois), 0),
            func.coalesce(func.sum(BonDeLivraison.retour_bois), 0),
        ).where(BonDeLivraison.client_id == client_id)
    ).one()

    p_consigne = int(row[0])
    p_nc       = int(row[1])
    p_back     = int(row[2])
    w_consigne = int(row[3])
    w_nc       = int(row[4])
    w_back     = int(row[5])

    p_balance = max(0, p_consigne + p_nc - p_back)
    w_balance = max(0, w_consigne + w_nc - w_back)

    return {
        "plastic_balance":  p_balance,
        "plastic_consigne": p_consigne,
        "plastic_nc":       p_nc,
        "plastic_back":     p_back,
        "wood_balance":     w_balance,
        "wood_consigne":    w_consigne,
        "wood_nc":          w_nc,
        "wood_back":        w_back,
    }


def _attach_balance(cr: ClientRead, bal: dict) -> ClientRead:
    cr.plastic_balance  = bal["plastic_balance"]
    cr.plastic_consigne = bal["plastic_consigne"]
    cr.plastic_nc       = bal["plastic_nc"]
    cr.wood_balance     = bal["wood_balance"]
    cr.wood_consigne    = bal["wood_consigne"]
    cr.wood_nc          = bal["wood_nc"]
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
