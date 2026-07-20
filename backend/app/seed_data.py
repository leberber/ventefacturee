"""Seed initial data: creates the admin user and default config on first startup."""
from sqlmodel import Session, select

from app.core.security import hash_password
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.config import AppConfig


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


def seed_config(session: Session) -> None:
    if session.get(AppConfig, "pricing"):
        return
    session.add(AppConfig(key="pricing", value={
        "consigne_plastique": 7500,
        "consigne_bois": 1200,
    }))
    session.commit()
    print("[seed] Config pricing créée")


def run_all(session: Session) -> None:
    seed_admin(session)
    seed_config(session)
