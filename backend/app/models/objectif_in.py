from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


class ObjectifIn(SQLModel, table=True):
    __tablename__ = "objectifs_in"
    __table_args__ = (UniqueConstraint("code_produit", "mois", "annee"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    code_produit: str = Field(max_length=30, index=True)
    mois: int
    annee: int
    objectif_tonne: Optional[float] = Field(default=None)

    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id")
    updated_by_id: Optional[int] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
