from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models.config import AppConfig, AppConfigUpdate
from app.api.deps import get_current_user, require_admin
from app.models.user import User

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
def get_all_config(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> Any:
    rows = session.exec(select(AppConfig)).all()
    return {row.key: row.value for row in rows}


@router.get("/{key}", response_model=Dict[str, Any])
def get_config(
    key: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> Any:
    row = session.get(AppConfig, key)
    if not row:
        raise HTTPException(status_code=404, detail=f"Config '{key}' introuvable")
    return row.value


@router.put("/{key}", response_model=Dict[str, Any])
def upsert_config(
    key: str,
    body: AppConfigUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
) -> Any:
    from datetime import datetime, timezone
    row = session.get(AppConfig, key)
    if row:
        row.value = body.value
        row.updated_at = datetime.now(timezone.utc)
    else:
        row = AppConfig(key=key, value=body.value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row.value
