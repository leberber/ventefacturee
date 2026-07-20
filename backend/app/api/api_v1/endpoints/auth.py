from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.database import get_session
from app.models.user import User, UserCreate, UserRead, UserRole
from app.core.security import verify_password, create_access_token, hash_password
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")
    return {"access_token": create_access_token(user), "token_type": "bearer"}


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/setup", response_model=UserRead, status_code=201)
def setup_first_admin(
    user_in: UserCreate,
    session: Session = Depends(get_session),
):
    """Creates the first admin account. Only works when no users exist."""
    if session.exec(select(User)).first():
        raise HTTPException(status_code=403, detail="Des utilisateurs existent déjà")
    user = User(
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=UserRole.ADMIN,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
