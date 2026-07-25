"""Seed initial data: creates the admin user on first startup."""
from sqlmodel import Session, select

from app.core.security import hash_password
from app.core.config import settings
from app.models.user import User, UserRole


def seed_admin(session: Session) -> None:
    existing = session.exec(select(User).where(User.phone == settings.ADMIN_PHONE)).first()
    if existing:
        return
    admin = User(
        phone=settings.ADMIN_PHONE,
        full_name=settings.ADMIN_FULL_NAME,
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(admin)
    session.commit()
    print(f"[seed] Admin créé : {settings.ADMIN_PHONE} / {settings.ADMIN_PASSWORD}")


def run_all(session: Session) -> None:
    seed_admin(session)
