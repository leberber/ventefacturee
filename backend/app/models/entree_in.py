from typing import Optional
from datetime import datetime, timezone, date as date_type
from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint


class EntreeIn(SQLModel, table=True):
    __tablename__ = "entrees_in"
    __table_args__ = (UniqueConstraint("code_produit", "date"),)

    id:                 Optional[int] = Field(default=None, primary_key=True)
    code_produit:       str           = Field(max_length=30, index=True)
    date:               date_type     = Field(index=True)
    quantite_colis:     float         = Field(default=0.0)
    created_by_id:      Optional[int] = Field(default=None, foreign_key="users.id")
    created_at:         datetime      = Field(default_factory=lambda: datetime.now(timezone.utc))
