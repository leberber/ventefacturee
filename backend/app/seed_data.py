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


def seed_staff(session: Session) -> None:
    DEFAULT_PASSWORD = "pallette2025"

    livreurs = [
        ("Hocine Mebarek",  "0555123001", UserRole.LIVREUR),
        ("Rachid Ait Ali",  "0555123002", UserRole.LIVREUR),
        ("Farid Tigrine",   "0555123003", UserRole.LIVREUR),
    ]
    chauffeurs = [
        ("Mourad Ouali",     "0555124001", UserRole.CHAUFFEUR),
        ("Yacine Boukhalfa", "0555124002", UserRole.CHAUFFEUR),
        ("Amar Meziane",     "0555124003", UserRole.CHAUFFEUR),
    ]

    for full_name, phone, role in livreurs + chauffeurs:
        existing = session.exec(select(User).where(User.phone == phone)).first()
        if existing:
            continue
        session.add(User(
            phone=phone,
            full_name=full_name,
            hashed_password=hash_password(DEFAULT_PASSWORD),
            role=role,
            is_active=True,
        ))
        print(f"[seed] {role.value} créé : {full_name} / {phone} / {DEFAULT_PASSWORD}")

    session.commit()


def run_all(session: Session) -> None:
    seed_admin(session)
    seed_config(session)
    seed_staff(session)
