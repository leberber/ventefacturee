from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.logging_config import get_log_stats, read_logs
from app.models.user import User, UserRole

router = APIRouter()


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux administrateurs")
    return current_user


@router.get("/logs")
def get_logs(
    lines: int = Query(default=100, ge=10, le=1000),
    level: Optional[str] = Query(default=None),
    current_user: User = Depends(_require_admin),
) -> Any:
    return {
        "entries": read_logs(lines=lines, level=level),
        "stats": get_log_stats(),
    }
