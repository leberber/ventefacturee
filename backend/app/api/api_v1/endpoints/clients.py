from typing import Any, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.client import Client, ClientCreate, ClientUpdate, ClientRead

router = APIRouter()


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
    return session.exec(q.order_by(Client.name)).all()


@router.post("", response_model=ClientRead, status_code=201)
def create_client(
    client_in: ClientCreate,
    session: Session = Depends(get_session),
) -> Any:
    client = Client(**client_in.model_dump())
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


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
    return client


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
