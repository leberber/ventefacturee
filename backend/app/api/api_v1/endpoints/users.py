from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models.user import User, UserCreate, UserUpdate, UserRead, UserRole
from app.core.security import hash_password
from app.api.deps import get_current_user, require_admin

router = APIRouter()


@router.get("", response_model=List[UserRead])
def list_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin),
) -> Any:
    return session.exec(select(User).order_by(User.full_name)).all()


@router.post("", response_model=UserRead, status_code=201)
def create_user(
    user_in: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin),
) -> Any:
    if session.exec(select(User).where(User.phone == user_in.phone)).first():
        raise HTTPException(status_code=400, detail="Ce numéro de téléphone est déjà utilisé")
    user = User(
        phone=user_in.phone,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin),
) -> Any:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    data = user_in.model_dump(exclude_unset=True)
    if "password" in data:
        data["hashed_password"] = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin),
) -> None:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    session.delete(user)
    session.commit()
